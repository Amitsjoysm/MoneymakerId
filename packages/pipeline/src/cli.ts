// The `mm` command (run with `pnpm mm <command>`). It discovers commands from the file names in
// src/commands/*.ts, so adding a command never means editing this file. The command name is the file
// name with its first `-` replaced by `:` (`import-csv.ts` is `mm import:csv`, `rank.ts` is `mm rank`).
// Every command module exports `description` and `run(args)`, which resolves to the exit code.
//
// Command modules are imported only when needed: running one command loads just that module, and
// `--help` loads all of them but survives a module that fails to load. Runs directly under Node's
// TypeScript type stripping, so keep this file free of runtime dependencies.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface CommandModule {
  description: string;
  run(args: string[]): Promise<number>;
}

/** A command found on disk, before its module is imported. */
export interface CommandFile {
  /** The name typed after `mm`, for example `import:csv`. */
  name: string;
  /** The file name inside the commands directory. */
  file: string;
}

export interface Command extends CommandModule, CommandFile {}

export interface HelpEntry {
  name: string;
  description: string;
}

export interface MainOptions {
  /** Directory to discover commands in. Defaults to src/commands next to this file. */
  dir?: string;
  out?: (text: string) => void;
  err?: (text: string) => void;
}

const COMMANDS_DIR = fileURLToPath(new URL('./commands/', import.meta.url));
const HELP_ARGS = new Set(['--help', '-h', 'help']);

/** `import-csv.ts` becomes `import:csv`. Returns null for files that are not commands. */
export function commandNameFromFile(file: string): string | null {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file.endsWith('.d.ts') || file.startsWith('.')) {
    return null;
  }
  return file.slice(0, -'.ts'.length).replace('-', ':');
}

/** Lists the command files in `dir`, sorted by name, without importing them. A missing directory is empty. */
export async function listCommandFiles(dir: string = COMMANDS_DIR): Promise<CommandFile[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const found: CommandFile[] = [];
  for (const entry of entries) {
    const name = entry.isFile() ? commandNameFromFile(entry.name) : null;
    if (name !== null) found.push({ name, file: entry.name });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

function isCommandModule(mod: unknown): mod is CommandModule {
  const m = mod as Partial<CommandModule> | null;
  return typeof m?.description === 'string' && typeof m?.run === 'function';
}

/** Imports one command module. Rejects when it cannot be imported or lacks `description` and `run`. */
export async function loadCommand(dir: string, { name, file }: CommandFile): Promise<Command> {
  let mod: unknown;
  try {
    mod = await import(pathToFileURL(join(dir, file)).href);
  } catch (error) {
    throw new Error(
      `${file}: cannot be imported (${error instanceof Error ? error.message : String(error)})`,
      {
        cause: error,
      },
    );
  }
  if (!isCommandModule(mod)) {
    throw new Error(`${file}: a command module must export description (string) and run(args) (function)`);
  }
  return { name, file, description: mod.description, run: mod.run };
}

export function formatHelp(entries: readonly HelpEntry[]): string {
  const lines = ['Usage: mm <command> [args...]', ''];
  if (entries.length === 0) {
    lines.push('Commands: no commands yet.');
  } else {
    const width = Math.max(...entries.map((e) => e.name.length));
    lines.push('Commands:');
    for (const e of entries) lines.push(`  ${e.name.padEnd(width)}  ${e.description}`);
  }
  return lines.join('\n');
}

async function helpText(dir: string, files: readonly CommandFile[]): Promise<string> {
  const entries = await Promise.all(
    files.map(async (file): Promise<HelpEntry> => {
      try {
        return { name: file.name, description: (await loadCommand(dir, file)).description };
      } catch (error) {
        return {
          name: file.name,
          description: `(cannot load: ${error instanceof Error ? error.message : error})`,
        };
      }
    }),
  );
  return formatHelp(entries);
}

/** Runs the CLI and returns the process exit code: 0 ok, 1 command failed, 2 unknown command. */
export async function main(argv: readonly string[], options: MainOptions = {}): Promise<number> {
  const dir = options.dir ?? COMMANDS_DIR;
  const out = options.out ?? ((text: string) => console.log(text));
  const err = options.err ?? ((text: string) => console.error(text));
  const files = await listCommandFiles(dir);
  const [name, ...args] = argv;

  if (name === undefined || HELP_ARGS.has(name)) {
    out(await helpText(dir, files));
    return 0;
  }
  const file = files.find((f) => f.name === name);
  if (file === undefined) {
    err(`Unknown command "${name}".\n\n${await helpText(dir, files)}`);
    return 2;
  }
  try {
    return await (await loadCommand(dir, file)).run(args);
  } catch (error) {
    err(`mm ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
