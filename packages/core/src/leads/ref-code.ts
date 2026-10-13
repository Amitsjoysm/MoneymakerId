// Attribution ref codes (plan §13): `Ref C-WAKAD-WP` is printed in every prefilled WhatsApp text and stored as
// `attribution.ref_code`, so a chat that starts outside the form can still be traced to a page.
//
// The code names the page context (vertical, locality, service). It is not a lead identifier, so it carries no
// random suffix; the lead's own unique reference (`MM-AB12CD`) is allocated by `api.submit_lead`.
import { CITY_ID } from '../constants/index.ts';
import { SlugSchema } from '../schema/index.ts';

/**
 * Service id -> ref-code abbreviation, for the 12 service ids of CONTRACTS §4a. `WP` is the plan's own example
 * (waterproofing); a letter in front names the sub-service. Unique, uppercase ASCII letters.
 */
export const SERVICE_REF_ABBR: Readonly<Record<string, string>> = Object.freeze({
  waterproofing: 'WP',
  'terrace-waterproofing': 'TWP',
  'bathroom-waterproofing': 'BWP',
  'external-wall-waterproofing': 'EWP',
  'basement-waterproofing': 'BSWP',
  'leakage-repair': 'LR',
  painting: 'PT',
  'interior-painting': 'IPT',
  'exterior-painting': 'EPT',
  'bathroom-renovation': 'BR',
  'modular-kitchen': 'MK',
  'house-construction': 'HC',
});

/** The `C-` prefix is the construction vertical (plan §13); food leads do not exist yet. */
const CONSTRUCTION_PREFIX = 'C';

/**
 * `C-{LOCALITY}-{SERVICE_ABBR}`, e.g. `C-WAKAD-WP`. The locality id is uppercased as is (hyphens kept), and a page
 * with no locality yet (a city guide, the calculator) uses the city: `C-PUNE-WP`. Deterministic.
 * Throws `RangeError` for a service without an abbreviation or a locality id that is not a lowercase ASCII slug.
 */
export function refCode({ localityId, serviceId }: { localityId: string | null; serviceId: string }): string {
  const abbr = Object.hasOwn(SERVICE_REF_ABBR, serviceId) ? SERVICE_REF_ABBR[serviceId] : undefined;
  if (abbr === undefined) throw new RangeError(`refCode: no abbreviation for service "${serviceId}"`);
  const locality = localityId ?? CITY_ID;
  if (!SlugSchema.safeParse(locality).success) {
    throw new RangeError(`refCode: locality "${locality}" is not a lowercase ASCII slug`);
  }
  return `${CONSTRUCTION_PREFIX}-${locality.toUpperCase()}-${abbr}`;
}
