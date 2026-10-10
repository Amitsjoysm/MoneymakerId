import { ConfigError } from './errors.ts';
import { nodeApi } from './node.ts';

/**
 * The repository root: the nearest directory at or above `from` (default: the current directory) that holds
 * `pnpm-workspace.yaml`. Never derived from `import.meta.url`, because Astro bundling moves files.
 * Node-only.
 */
export function findRepoRoot(from?: string): string {
  const { fs, path, cwd } = nodeApi();
  const start = path.resolve(from ?? cwd());
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new ConfigError(`No pnpm-workspace.yaml found in or above ${start}; cannot locate the repository root.`);
    }
    dir = parent;
  }
}
