// trustLabels(evidence, business, now) (spec §71, plan §8). Pure.
import type { EvidenceView, PlaceView, ProviderView, TrustLabel } from '../schema/index.ts';
import { RECENTLY_CHECKED_DAYS } from './thresholds.ts';
import { MS_PER_DAY, lastChecked } from './validity.ts';

/**
 * The trust labels earned by a business, in TrustLabel order. `evidence` is every row attached to the
 * business (its own, its dishes' and its services'); it is not filtered by entity here.
 *
 * Only active, unexpired rows with a citable source count (see ./validity.ts), so expired evidence never
 * yields a fresh or verified label. These labels are not gated by MIN_LABEL_EVIDENCE: "source-backed" means
 * at least one sourced row (plan §8).
 *
 * - verified: set by an admin (`verification_status` and a `verified_at` date), and the business still has
 *   citable live evidence. The view carries no method column, so the method is not checked here.
 * - recently_checked: the newest citable live row was retrieved within RECENTLY_CHECKED_DAYS
 * - source_backed: at least one citable live row
 * - price_checked / hours_checked: a citable live price / hours row exists. Show the date with
 *   `lastChecked(evidence, now, 'price' | 'hours')`.
 */
export function trustLabels(
  evidence: readonly EvidenceView[],
  business: PlaceView | ProviderView,
  now: Date,
): TrustLabel[] {
  const newest = lastChecked(evidence, now);
  const labels: TrustLabel[] = [];
  if (newest === null) return labels;
  if (business.verification_status === 'verified' && business.verified_at !== null) labels.push('verified');
  if (now.getTime() - newest.getTime() <= RECENTLY_CHECKED_DAYS * MS_PER_DAY) labels.push('recently_checked');
  labels.push('source_backed'); // `newest` exists, so at least one citable live row does too
  if (lastChecked(evidence, now, 'price') !== null) labels.push('price_checked');
  if (lastChecked(evidence, now, 'hours') !== null) labels.push('hours_checked');
  return labels;
}
