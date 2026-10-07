import { defineConfig } from 'vitest/config';

// Multi-project config for the root `pnpm test`, which passes it explicitly (`vitest --config
// vitest.workspace.ts`). Vitest 4 no longer reads a file of this name by itself, and it must not be called
// vitest.config.ts: Vitest looks for a config in parent folders, so a root vitest.config.ts would also be
// picked up by each package's own `vitest run` (`pnpm -r test`) and break it.
//
// Every folder under packages/ and apps/ is a project. It uses that folder's own vitest.config.ts when
// there is one (packages/edge runs in the Workers runtime), and plain Node defaults otherwise.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
