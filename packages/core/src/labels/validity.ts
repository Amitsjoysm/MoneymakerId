// When is an evidence row still valid? Shared by the trust labels and by the freshness component of the
// scorers. CONTRACTS §8a: a claim stays valid for the TTL of its tier (CLAIM_TIER, TIER_TTL_DAYS) after
// `retrieved_at`, unless its source states its own date (`valid_until`), which then wins.
import { CLAIM_TIER, TIER_TTL_DAYS } from '../constants/index.ts';
import type { EvidenceView } from '../schema/index.ts';

export const MS_PER_DAY = 86_400_000;

/** The span in which a row is valid, as epoch milliseconds. */
export interface EvidenceWindow {
  start: number;
  end: number;
}

type Dated = Pick<EvidenceView, 'claim_type' | 'retrieved_at' | 'valid_until'>;

/**
 * The validity window of a row, or null when its timestamps cannot be read or end before they start.
 * The TTL comes from `CLAIM_TIER[claim_type]`, not from the stored `tier` column, so a stale column cannot
 * stretch a lifetime.
 */
export function evidenceWindow(e: Dated): EvidenceWindow | null {
  const start = Date.parse(e.retrieved_at);
  if (!Number.isFinite(start)) return null;
  const end =
    e.valid_until === null
      ? start + TIER_TTL_DAYS[CLAIM_TIER[e.claim_type]] * MS_PER_DAY
      : Date.parse(e.valid_until);
  if (!Number.isFinite(end) || end < start) return null;
  return { start, end };
}

/**
 * True when the row is active and `now` falls inside its window (the end instant counts as valid).
 * Superseded and rejected rows, expired rows, rows retrieved in the future and unreadable rows are not live.
 */
export function isLive(e: EvidenceView, now: Date): boolean {
  if (e.status !== 'active') return false;
  const window = evidenceWindow(e);
  const t = now.getTime();
  return window !== null && window.start <= t && t <= window.end;
}

/**
 * True when the row can back a visible claim: it is live and its source is something we may cite. An
 * aggregator is a discovery pointer only (spec §87, plan §8), and only a first-hand source may omit its URL.
 */
export function isCitable(e: EvidenceView, now: Date): boolean {
  if (!isLive(e, now)) return false;
  const { kind, url } = e.source;
  return kind !== 'aggregator' && (url !== null || kind === 'first_hand');
}

/**
 * When the newest citable, live row was retrieved (for `claimType` if given, else of any type), for "price
 * last checked" copy; null when there is none.
 */
export function lastChecked(
  evidence: readonly EvidenceView[],
  now: Date,
  claimType?: EvidenceView['claim_type'],
): Date | null {
  let newest: number | null = null;
  for (const e of evidence) {
    if ((claimType !== undefined && e.claim_type !== claimType) || !isCitable(e, now)) continue;
    const t = Date.parse(e.retrieved_at);
    if (newest === null || t > newest) newest = t;
  }
  return newest === null ? null : new Date(newest);
}
