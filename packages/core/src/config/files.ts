// Low-level readers shared by the typed loaders: read a file under the repository root, parse it, validate it
// with a Zod schema and fail with a `ConfigError` that names the file and the failing paths. Node-only.
import type { z } from 'zod';
import { ConfigError } from './errors.ts';
import { nodeApi } from './node.ts';
import { findRepoRoot } from './repo-root.ts';

export interface LoadOptions {
  /** The repository root. Default: found by walking up from the current directory to `pnpm-workspace.yaml`. */
  root?: string;
}

export function rootOf(opts?: LoadOptions): string {
  return opts?.root ?? findRepoRoot();
}

/** `a/b.json`-style path (always `/`) of an absolute path under `root`, for error messages. */
function display(root: string, rel: string): string {
  return rel.replaceAll('\\', '/') || root;
}

const MAX_ISSUES = 8;

/** One line per Zod issue (at most 8): `path: message`. */
export function formatIssues(error: z.ZodError): string {
  const lines = error.issues.slice(0, MAX_ISSUES).map((i) => {
    const path = i.path.map(String).join('.') || '(root)';
    return `  ${path}: ${i.message}`;
  });
  if (error.issues.length > MAX_ISSUES) lines.push(`  … and ${error.issues.length - MAX_ISSUES} more`);
  return lines.join('\n');
}

/** Validates `value`; throws a `ConfigError` naming `file` (and `where`, such as a CSV line) on failure. */
export function parseWith<S extends z.ZodType>(
  schema: S,
  value: unknown,
  file: string,
  where = '',
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ConfigError(`${file}${where}: invalid\n${formatIssues(result.error)}`, file);
  }
  return result.data;
}

/** Whether `rel` (relative to the repository root, `/`-separated) exists. */
export function fileExists(rel: string, opts?: LoadOptions): boolean {
  const { fs, path } = nodeApi();
  return fs.existsSync(path.join(rootOf(opts), rel));
}

/** Reads `rel` as UTF-8 text. A missing file is a `ConfigError`, not an `ENOENT` stack. */
export function readText(rel: string, opts?: LoadOptions): string {
  const { fs, path } = nodeApi();
  const root = rootOf(opts);
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) throw new ConfigError(`${display(root, rel)}: file not found`, rel);
  return fs.readFileSync(abs, 'utf8');
}

/** The names (not paths) of the files in `dirRel` that end in `ext`, sorted. A missing directory is empty. */
export function listFiles(dirRel: string, ext: string, opts?: LoadOptions): string[] {
  const { fs, path } = nodeApi();
  const abs = path.join(rootOf(opts), dirRel);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((name) => name.endsWith(ext))
    .sort();
}

/** Reads, parses and validates one JSON file. */
export function readJson<S extends z.ZodType>(rel: string, schema: S, opts?: LoadOptions): z.output<S> {
  const text = readText(rel, opts);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ConfigError(`${rel}: not valid JSON (${(e as Error).message})`, rel);
  }
  return parseWith(schema, raw, rel);
}
