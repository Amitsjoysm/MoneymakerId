// Node-only access for the config loaders.
//
// @mm/core also runs on the Cloudflare Workers runtime, and its source is type-checked without Node types
// (tsconfig.json: `types: []`). So there is no static `node:fs` import here. This file declares the few
// Node members it uses and reaches them through `process.getBuiltinModule` (Node >= 22.3, and the repository
// floor is 22.18). Importing `@mm/core/config` therefore never fails to bundle or load on Workers; only
// calling a loader there fails, with a clear error.
import { ConfigError } from './errors.ts';

export interface NodeFs {
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(path: string): string[];
  existsSync(path: string): boolean;
}

export interface NodePath {
  join(...parts: string[]): string;
  dirname(path: string): string;
  resolve(...parts: string[]): string;
  relative(from: string, to: string): string;
}

export interface NodeApi {
  fs: NodeFs;
  path: NodePath;
  cwd(): string;
}

interface NodeProcessLike {
  cwd?: () => string;
  getBuiltinModule?: (id: string) => unknown;
}

export function nodeApi(): NodeApi {
  const proc = (globalThis as unknown as { process?: NodeProcessLike }).process;
  if (!proc?.getBuiltinModule || !proc.cwd) {
    throw new ConfigError('@mm/core/config is Node-only: it reads data/ from disk and cannot run on Workers.');
  }
  const cwd = proc.cwd.bind(proc);
  return {
    fs: proc.getBuiltinModule('node:fs') as NodeFs,
    path: proc.getBuiltinModule('node:path') as NodePath,
    cwd,
  };
}
