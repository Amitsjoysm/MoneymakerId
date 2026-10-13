// @mm/core/intent (owner C01): free text -> `ParsedIntent` for /api/ask and the search box. Rule-based: no AI, no
// network, no files; the reference data comes in as arguments. Pure and runtime-neutral (Node and Workers).
export { parseIntent } from './parse.ts';
export type { IntentRefs } from './parse.ts';
