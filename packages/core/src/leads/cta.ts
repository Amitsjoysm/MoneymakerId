// Honest quote CTAs (plan §13). "Get up to 3 free quotes" is a promise about how many contractors can answer, so it
// is shown only when at least 3 active providers accept leads for that service x locality. Otherwise the CTA only
// promises a connection to one local contractor. This module is the single place that decision is made.

/** How many accepting providers the "up to 3 quotes" wording needs. */
const MIN_PROVIDERS_FOR_THREE_QUOTES = 3;

export type CtaCopy = {
  /** The button or heading text. */
  label: string;
  /** One sentence under it that names the service and the place. */
  description: string;
  /** The reassurance line under the form (plan §13 microcopy). */
  microcopy: string;
  /** True when the copy implies several contractors may quote. Page code can assert on it. */
  promisesMultipleQuotes: boolean;
};

/**
 * @param acceptingProviders active providers that accept leads for this service x locality. Anything that is not a
 *   whole number of at least 3 (NaN, a fraction, a negative, bad data) gets the fewer-providers wording.
 * @param service display name of the service, e.g. `terrace waterproofing`.
 * @param locality display name of the locality, e.g. `Wakad`; `null` for a city-level page (reads "Pune").
 */
export function ctaCopy({
  acceptingProviders,
  service,
  locality,
}: {
  acceptingProviders: number;
  service: string;
  locality: string | null;
}): CtaCopy {
  const job = `Tell us about your ${service} job in ${locality ?? 'Pune'}`;
  if (Number.isInteger(acceptingProviders) && acceptingProviders >= MIN_PROVIDERS_FOR_THREE_QUOTES) {
    return {
      label: 'Get up to 3 free quotes',
      description: `${job} and we'll share it with local contractors who take this work.`,
      microcopy: 'Free · no obligation · shared with at most 3 verified contractors · no spam calls',
      promisesMultipleQuotes: true,
    };
  }
  return {
    label: "Get a free quote — we'll connect you with a local contractor",
    description: `${job} and we'll connect you with a local contractor.`,
    microcopy: 'Free · no obligation · no spam calls',
    promisesMultipleQuotes: false,
  };
}
