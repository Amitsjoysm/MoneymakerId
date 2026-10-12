// @mm/core/config (owner T01): typed loaders for `data/**` and `content/locality-guides/*.md`.
//
// NODE-ONLY. The loaders read the disk and locate the repository root by walking up to
// `pnpm-workspace.yaml`, so they work wherever bundling moves the code but cannot run on Workers. Nothing here
// imports `node:*` statically (see node.ts), so importing this module on Workers does not fail to bundle;
// calling a loader there throws a `ConfigError`. Workers code must not import it.
export * from './errors.ts';
export * from './repo-root.ts';
export * from './csv.ts';
export * from './frontmatter.ts';
export * from './files.ts';
export * from './loaders.ts';
