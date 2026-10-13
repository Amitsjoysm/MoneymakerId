// The locality tree: sub-localities and `near-*` landmarks hang off a parent through `parent_id`. Pure.
import type { Locality } from '../schema/index.ts';

/**
 * `id` followed by every descendant, level by level (children keep their order in `localities`). Landmarks of a
 * sub-locality count as descendants of its parent locality. Returns `[]` when `id` is not in `localities`. Each id
 * appears once, and a parent cycle in bad data ends instead of looping.
 */
export function subtree(id: string, localities: readonly Locality[]): string[] {
  if (!localities.some((l) => l.id === id)) return [];
  const childrenOf = new Map<string, string[]>();
  for (const l of localities) {
    if (l.parent_id === null) continue;
    const siblings = childrenOf.get(l.parent_id);
    if (siblings) siblings.push(l.id);
    else childrenOf.set(l.parent_id, [l.id]);
  }
  const out = [id];
  const seen = new Set(out);
  for (let i = 0; i < out.length; i++) {
    for (const child of childrenOf.get(out[i]!) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
    }
  }
  return out;
}
