/// <reference types="astro/client" />
/// <reference path="../../../packages/edge/src/worker-env.d.ts" />

// Build-time values (CONTRACTS §10). They come from the build environment, not from the Worker's `env`, and
// are read with `import.meta.env`. Runtime values: `import { env } from 'cloudflare:workers'`.
interface ImportMetaEnv {
  /** `fixtures` builds from the checked-in fixtures (CI and local UI work); anything else reads the database. */
  readonly DATA_SOURCE?: string;
  /** `true` once the launch gate has passed; until then the sites are `noindex`. */
  readonly PUBLIC_LAUNCHED?: string;
  /** Path of the build manifest written by `buildManifest` (CONTRACTS §6). */
  readonly MM_MANIFEST_PATH?: string;
}
