import { getViteConfig } from 'astro/config';

// @mm/ui tests run in Node through Astro's Vite config, so a test can render `.astro` components with the
// container API (`experimental_AstroContainer`). The CSS budget test also runs a real `astro build` of the
// construction app's fixture pages, which takes longer than the default timeout.
export default getViteConfig({
  test: {
    name: '@mm/ui',
    include: ['src/**/*.test.ts'],
    testTimeout: 15_000,
  },
});
