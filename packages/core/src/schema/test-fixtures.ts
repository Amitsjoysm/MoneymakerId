// Valid sample payloads shared by the schema tests. Not exported from @mm/core/schema.

/** A complete, valid `POST /api/lead` body for a construction quote. */
export function leadSubmission(): Record<string, unknown> {
  return {
    lead_type: 'quote',
    idempotency_key: crypto.randomUUID(),
    turnstile_token: 'turnstile-token',
    consent: { version: 'lead-consent-v1', accepted: true },
    name: 'Asha Patil',
    phone: '98343 46179',
    quote: {
      service_id: 'terrace-waterproofing',
      locality_id: 'wakad',
      property_type: 'flat',
      ownership: 'owner',
      timeline: 'within_1_month',
      area: { preset: 'terrace', quantity: 1000 },
      tier: 'standard',
      estimate: { low: 40000, expected: 60000, high: 90000 },
      requested_provider_id: null,
      notes: null,
    },
    business: null,
    message: null,
    attribution: {
      landing_path: '/pune/wakad/terrace-waterproofing/',
      page_type: 'locality_service',
      referrer_class: 'search',
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      ranking_run_id: null,
      ref_code: 'C-WAKAD-WP',
      variant: null,
    },
  };
}
