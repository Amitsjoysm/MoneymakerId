// @mm/core/locality (owner C01): locality lookup for the pages and for Ask. Reads no files; the reference data comes
// in as arguments. Pure and runtime-neutral (Node and Cloudflare Workers).
export { haversineM, nearest } from './geo.ts';
export type { NearestOptions, NearestResult } from './geo.ts';
export { resolveLocality } from './resolve.ts';
export type { LocalityMatch } from './resolve.ts';
export { subtree } from './tree.ts';
export { damerauLevenshtein, foldText, normaliseText, tokenise } from './text.ts';
