// Props shared by the evidence ribbon's parts.
import type { SourceRef } from '@mm/core/schema';

/** One source on the ribbon, with what it says about the figure. */
export interface SlipSource {
  source: SourceRef;
  /** The figure this source gives, copied from its quote ("₹35–₹60"). Omit when the quote has no figure. */
  figure?: string | null;
  /** Where the source's figure applies ("Pune", "India"), when the source says so. */
  scope?: string | null;
  /** Past its freshness window (decided upstream from the claim tier's TTL): struck through, marked in signal. */
  stale?: boolean;
}

/** One preset of the estimate segment, already estimated by the page with @mm/core/cost. */
export interface EstimatePreset {
  /** The `AreaPreset` value (`terrace`, `2bhk`…). */
  value: string;
  /** Chip text ("Terrace"). */
  label: string;
  /** Chip detail ("1,000 sq ft"). */
  detail: string;
  low: number;
  expected: number;
  high: number;
  /** One line on what the preset assumes, shown under its total. */
  note?: string | null;
}
