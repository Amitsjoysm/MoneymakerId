import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/.astro/',
    '**/.wrangler/',
    '**/coverage/',
    '**/playwright-report/',
    '**/test-results/',
    '.lighthouseci/',
    // Tooling and curated content that are not application code.
    '.claude/',
    '.superpowers/',
    '.code-review-graph/',
    '.impeccable/',
    'data/',
    'content/',
    'docs/',
    'supabase/migrations/',
  ]),

  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,

  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Browser code: Astro components and the vanilla TypeScript islands.
    files: ['**/*.astro', 'packages/ui/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
