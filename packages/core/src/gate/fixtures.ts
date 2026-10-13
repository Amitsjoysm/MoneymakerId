// TEST-ONLY fixtures for @mm/core/gate. Nothing in the package imports this file at run time; only *.test.ts files
// do. It is not data: every business, provider, fact and price here is invented and named "Example ...".
import type { GateConfig, GateKey, ManifestEntry, PageCandidate } from '../schema/index.ts';

/** A fixed "now" for the timeline tests. */
export const NOW = new Date('2026-10-12T06:00:00.000Z');
export const DAY_MS = 86_400_000;

export function daysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

export const RULE_DEFAULTS = {
  min_entities: 3,
  min_evidence: 6,
  min_relevance: 0.6,
  min_unique: 0.5,
  seo_min: 0.5,
  requires_reviewed_prose: false,
  extra: {} as Record<string, number>,
};

/** A small config in the shape of data/gate.json; the thresholds are the shipped ones for these keys. */
export function makeConfig(pages: Partial<Record<GateKey, Partial<typeof RULE_DEFAULTS>>> = {}): GateConfig {
  const base: Record<string, typeof RULE_DEFAULTS> = {};
  const defaults: Partial<Record<GateKey, Partial<typeof RULE_DEFAULTS>>> = {
    'food:dish_locality': {},
    'food:dish_city': { min_entities: 5, min_evidence: 5, extra: { min_localities: 2 } },
    'construction:service_cost': {
      min_entities: 0,
      min_evidence: 0,
      requires_reviewed_prose: true,
      extra: { min_sources: 2 },
    },
    'construction:locality_service': {
      min_entities: 0,
      min_evidence: 0,
      extra: { min_local_facts: 3, min_providers: 2, min_quotes: 3, min_factor_sources: 2 },
    },
  };
  for (const [key, over] of Object.entries({ ...defaults, ...pages })) {
    base[key] = { ...RULE_DEFAULTS, ...over };
  }
  return { pages: base, hysteresis_ratio: 0.8, noindex_grace_days: 30 } as GateConfig;
}

const SEO_ALL = (v: number): PageCandidate['seo_inputs'] => ({
  demand: v,
  data_quality: v,
  locality_specificity: v,
  commercial_intent: v,
  content_depth: v,
  freshness: v,
});
export { SEO_ALL as seoAll };

let counter = 0;

/** A candidate that passes the `food:dish_locality` rule of `makeConfig`, unless overridden. */
export function makeCandidate(over: Partial<PageCandidate> = {}): PageCandidate {
  counter += 1;
  const n = counter;
  return {
    url: `/pune/example-locality-${n}/biryani/`,
    host: 'food',
    locale: 'en',
    page_type: 'dish_locality',
    parent_url: `/pune/example-locality-${n}/`,
    entity_ids: [],
    evidence_count: 8,
    entity_count: 4,
    relevance: 1,
    main_text: `Example page ${n} alpha${n} bravo${n} charlie${n} delta${n} echo${n} foxtrot${n} golf${n} hotel${n}`,
    data_inputs: { n },
    prose_keys: [],
    seo_inputs: SEO_ALL(0.8),
    extra: {},
    ...over,
  };
}

/** A manifest entry as a previous build would have written it. */
export function makeEntry(over: Partial<ManifestEntry> & Pick<ManifestEntry, 'url'>): ManifestEntry {
  return {
    host: 'food',
    locale: 'en',
    page_type: 'dish_locality',
    indexable: true,
    content_hash: 'a'.repeat(64),
    hash_changed_at: '2026-09-01T00:00:00.000Z',
    gate: {
      gate_key: 'food:dish_locality',
      scores: { evidence: 8, entities: 4, relevance: 1, unique: 1, seo: 0.8 },
      passed: true,
      reasons: [],
    },
    noindex_since: null,
    redirect_to: null,
    ...over,
  };
}

// --- the example catalogue ------------------------------------------------------------------------------------
// A small invented Pune: four localities, two services, three cost models, six restaurants, two providers. It is
// built so that some pages pass the shipped gate and others fail it for a known reason (see candidates.test.ts).
import type {
  CatalogueSnapshot,
  CostModel,
  Dish,
  EvidenceView,
  ExperienceView,
  LocalFact,
  Locality,
  PlaceView,
  ProviderView,
  ServiceDef,
  SourceRef,
} from '../schema/index.ts';

export const uuid = (n: number): string => `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;

export function makeSource(publisher: string, over: Partial<SourceRef> = {}): SourceRef {
  return {
    url: `https://example.com/${publisher.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: `Example page by ${publisher}`,
    publisher,
    retrieved_at: '2026-09-20',
    quote: null,
    ...over,
  };
}
const SRC_A = makeSource('Example Publisher A');
const SRC_B = makeSource('Example Publisher B');

export function makeFact(
  id: string,
  services: string[],
  text: string,
  status: LocalFact['status'] = 'reviewed',
): LocalFact {
  return { id, topic: 'housing_stock', text, services, sources: [SRC_A, SRC_B], status };
}

export function makeLocality(id: string, over: Partial<Locality> = {}): Locality {
  return {
    id,
    name: id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    kind: 'locality',
    city_id: 'pune',
    parent_id: null,
    aliases: [],
    geo: { lat: 18.5, lng: 73.8 },
    geo_source: SRC_A,
    jurisdiction: 'PMC',
    pincodes: [],
    neighbours: [],
    landmarks: [],
    commercial_centres: [],
    office_clusters: [],
    residential_clusters: [],
    construction_facts: [],
    food_notes: [],
    i18n: { mr: null, hi: null },
    ...over,
  };
}

export function makeDish(id: string, over: Partial<Dish> = {}): Dish {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
    parent_id: null,
    aliases: [],
    cravings: [],
    diet: 'both',
    price_bands_inr: [150, 250, 400],
    price_sanity_inr: { min: 20, max: 900 },
    description: `Example description of ${id}.`,
    prose_status: 'reviewed',
    i18n: { mr: null, hi: null },
    ...over,
  };
}

export function makeService(
  id: string,
  parent_id: string | null,
  over: Partial<ServiceDef> = {},
  sub_services: ServiceDef[] = [],
): ServiceDef {
  return {
    id,
    name: id.replace(/-/g, ' '),
    parent_id,
    unit: 'sqft',
    area_presets: [],
    scope_options: [],
    materials: [],
    duration_days: null,
    questions_to_ask: [`Which ${id} warranty do you give in writing?`],
    common_mistakes: [`Skipping surface preparation before ${id} starts.`],
    quote_checklist: [`Ask for the ${id} area measured on site.`],
    faq: [{ q: `How long does ${id} last?`, a: `Example answer about ${id} durability and upkeep.` }],
    prose_status: 'reviewed',
    sub_services,
    ...over,
  };
}

export function makeModel(id: string, service_id: string, over: Partial<CostModel> = {}): CostModel {
  return {
    id,
    service_id,
    scope_id: null,
    material_id: null,
    tier: 'standard',
    unit: 'sqft',
    rate_inr: { low: 40, expected: 55, high: 80 },
    min_job_inr: null,
    components: { materials: 0.4, labour: 0.3, preparation: 0.1, repair: 0.1, transport: 0.05, waste: 0.05 },
    locality_factors: [],
    sources: [SRC_A, SRC_B],
    reviewed_at: '2026-09-20',
    valid_until: '2027-03-20',
    status: 'reviewed',
    notes: '',
    ...over,
  };
}

let evidenceN = 0;
export function makeEvidence(
  entity_id: string,
  claim: EvidenceView['claim'],
  over: Partial<EvidenceView> = {},
): EvidenceView {
  evidenceN += 1;
  const claim_type = Object.keys(claim)[0] as EvidenceView['claim_type'];
  return {
    id: uuid(0x10000 + evidenceN),
    source_id: uuid(0x20000 + evidenceN),
    entity_type: 'business',
    entity_id,
    claim_type,
    claim,
    supporting_quote: null,
    source: {
      kind: 'article',
      url: SRC_A.url,
      title: SRC_A.title,
      publisher: SRC_A.publisher,
      experience_id: null,
    },
    retrieved_at: daysBefore(NOW, 5),
    valid_until: null,
    confidence: 0.9,
    extractor_version: 'example-1',
    status: 'active',
    tier: claim_type === 'price' || claim_type === 'hours' ? 'HOT' : 'WARM',
    ...over,
  };
}

interface PlaceSpec {
  n: number;
  name: string;
  locality_id: string;
  dish_id: string;
  price_inr: number;
  diet: PlaceView['diet'];
  tags?: string[];
  hours?: PlaceView['opening_hours'];
  /** Publishers of the evidence rows; two different publishers make the place independently sourced. */
  publishers: string[];
}

/** A restaurant, its dish listing and its evidence rows (a `price` row, a `dish` row, plus an `hours` row if it has hours). */
function place(spec: PlaceSpec): { place: PlaceView; evidence: EvidenceView[] } {
  const id = uuid(spec.n);
  const via = (i: number): EvidenceView['source'] => {
    const publisher = spec.publishers[i % spec.publishers.length] ?? 'Example Publisher A';
    return {
      kind: 'article',
      url: makeSource(publisher).url,
      title: `Example ${publisher} listing`,
      publisher,
      experience_id: null,
    };
  };
  const priceRow = makeEvidence(
    id,
    { price: { dish_id: spec.dish_id, service_id: null, price_inr: spec.price_inr, unit: 'serving' } },
    {
      source: via(0),
      supporting_quote: `Example menu line: ${spec.name} lists ${spec.dish_id} at ${spec.price_inr} rupees.`,
    },
  );
  const dishRow = makeEvidence(
    id,
    { dish: { dish_id: spec.dish_id, variant_label: null } },
    {
      source: via(1),
      supporting_quote: `Example review line: regulars order the ${spec.dish_id} at ${spec.name}.`,
    },
  );
  const evidence = [priceRow, dishRow];
  if (spec.hours) evidence.push(makeEvidence(id, { hours: spec.hours }, { source: via(0) }));
  return {
    place: {
      id,
      slug: spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: spec.name,
      locality_id: spec.locality_id,
      address: `Example Road ${spec.n}, ${spec.locality_id}`,
      geo: null,
      website: null,
      price_level: 1,
      cuisines: ['indian'],
      diet: spec.diet,
      service_modes: ['dine_in'],
      opening_hours: spec.hours ?? null,
      tags: spec.tags ?? [],
      verification_status: 'unverified',
      verified_at: null,
      last_verified_at: null,
      auto_published: true,
      reviewed_at: null,
      dishes: [
        {
          dish_id: spec.dish_id,
          variant_label: null,
          price_inr: spec.price_inr,
          evidence_id: priceRow.id,
          last_seen_at: daysBefore(NOW, 5),
        },
      ],
    },
    evidence,
  };
}

function provider(
  n: number,
  name: string,
  services: string[],
  service_localities: string[],
  specializations: string[],
) {
  const row: ProviderView = {
    id: uuid(0x500 + n),
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    locality_id: 'hinjewadi',
    service_localities,
    services,
    specializations,
    experience_years: null,
    accepts_leads: true,
    verification_status: 'unverified',
    verified_at: null,
    founding_partner: false,
    auto_published: true,
    reviewed_at: null,
  };
  const evidence = makeEvidence(
    row.id,
    { service: { service_id: services[0] ?? 'waterproofing' } },
    { entity_type: 'provider_service' },
  );
  return { row, evidence };
}

/** `count` distinct words that start with `seed`, as one paragraph (for locality guides of a known length). */
export function paragraph(seed: string, count: number): string {
  return Array.from({ length: count }, (_, i) => `${seed}${i}`).join(' ');
}

export function exampleSnapshot(): CatalogueSnapshot {
  evidenceN = 0; // row ids come from this counter; a fresh snapshot must be identical to the last one
  const p1 = place({
    n: 1,
    name: 'Example Biryani House',
    locality_id: 'hinjewadi',
    dish_id: 'biryani',
    price_inr: 180,
    diet: 'veg',
    tags: ['family'],
    publishers: ['Example Publisher A'],
  });
  const p2 = place({
    n: 2,
    name: 'Example Dum Kitchen',
    locality_id: 'hinjewadi-phase-1',
    dish_id: 'biryani',
    price_inr: 220,
    diet: 'veg',
    tags: ['office-lunch'],
    publishers: ['Example Publisher A', 'Example Publisher B'],
  });
  const p3 = place({
    n: 3,
    name: 'Example Spice Table',
    locality_id: 'hinjewadi',
    dish_id: 'biryani',
    price_inr: 260,
    diet: 'veg',
    tags: ['family'],
    publishers: ['Example Publisher A', 'Example Publisher B'],
  });
  const p4 = place({
    n: 4,
    name: 'Example Night Bites',
    locality_id: 'hinjewadi',
    dish_id: 'biryani',
    price_inr: 300,
    diet: 'non_veg',
    tags: ['family'],
    hours: { fri: [['18:00', '24:00']], sat: [['18:00', '01:00']] },
    publishers: ['Example Publisher A', 'Example Publisher B'],
  });
  const p5 = place({
    n: 5,
    name: 'Example Wakad Biryani',
    locality_id: 'wakad',
    dish_id: 'biryani',
    price_inr: 240,
    diet: 'both',
    publishers: ['Example Publisher A', 'Example Publisher B'],
  });
  const p6 = place({
    n: 6,
    name: 'Example Baner Misal',
    locality_id: 'baner',
    dish_id: 'misal-pav',
    price_inr: 90,
    diet: 'veg',
    publishers: ['Example Publisher A'],
  });
  const places = [p1, p2, p3, p4, p5, p6];

  const pv1 = provider(
    1,
    'Example Terrace Seal Works',
    ['waterproofing', 'terrace-waterproofing'],
    ['hinjewadi', 'wakad'],
    ['terrace waterproofing', 'roof coating'],
  );
  const pv2 = provider(2, 'Example Roof Care Services', ['terrace-waterproofing'], [], ['crack repair']);

  const experience: ExperienceView = {
    id: uuid(0x900),
    business_id: p1.place.id,
    visited_at: '2026-10-03',
    dishes: [
      {
        dish_id: 'biryani',
        price_paid_inr: 180,
        rating: 4,
        notes: 'Example visit note: the dum seal was opened at the table.',
      },
    ],
    overall_rating: 4,
    would_recommend: true,
    tags: [],
    notes: 'Example visit: a calm weekday lunch.',
    prose_status: 'reviewed',
    photos: [],
  };

  const terraceFacts = [
    makeFact(
      'hinjewadi-housing_stock-1',
      ['terrace-waterproofing'],
      'Example fact: most society towers in this belt date from the mid 2010s and use flat concrete terraces.',
    ),
    makeFact(
      'hinjewadi-rainfall-1',
      ['terrace-waterproofing'],
      'Example fact: heavy monsoon rainfall here makes parapet junction leaks common on older terraces.',
    ),
    makeFact(
      'hinjewadi-rules-1',
      ['terrace-waterproofing'],
      'Example fact: society managing committees usually need written approval before terrace work starts.',
    ),
  ];

  const localities = [
    makeLocality('hinjewadi', {
      neighbours: ['wakad'],
      construction_facts: [
        ...terraceFacts,
        makeFact(
          'hinjewadi-building_age-1',
          ['waterproofing'],
          'Example fact: towers older than ten years here often need a full membrane replacement rather than a patch.',
        ),
        makeFact(
          'hinjewadi-other-1',
          ['painting'],
          'Example fact: exterior painting in this belt is usually scheduled after the monsoon ends.',
        ),
      ],
    }),
    makeLocality('hinjewadi-phase-1', { kind: 'sub_locality', parent_id: 'hinjewadi' }),
    makeLocality('wakad', {
      neighbours: ['hinjewadi'],
      construction_facts: [
        makeFact(
          'wakad-other-1',
          ['painting'],
          'Example fact: a draft note about interior painting timing in Wakad societies.',
          'draft',
        ),
      ],
    }),
    makeLocality('baner'),
  ];

  const snapshot: CatalogueSnapshot = {
    snapshot_id: 'example-snapshot-1',
    generated_at: NOW.toISOString(),
    localities,
    locality_profiles: [],
    dishes: [
      makeDish('biryani'),
      makeDish('misal-pav', { price_bands_inr: [60, 120], prose_status: 'draft' }),
    ],
    services: [
      makeService('waterproofing', null, {}, [makeService('terrace-waterproofing', 'waterproofing')]),
      makeService('painting', null, { prose_status: 'draft' }),
    ],
    cost_models: [
      makeModel('tw-standard', 'terrace-waterproofing', {
        locality_factors: [
          { locality_id: 'hinjewadi', factor: 1.15, sources: [SRC_A, SRC_B] },
          { locality_id: 'wakad', factor: 1, sources: [SRC_A, SRC_B] },
        ],
      }),
      makeModel('tw-premium', 'terrace-waterproofing', { tier: 'premium' }),
      makeModel('wp-standard', 'waterproofing'),
      makeModel('painting-standard', 'painting', { status: 'draft' }),
    ],
    locality_guides: [
      {
        locality_id: 'hinjewadi',
        title: 'Example guide to Hinjewadi',
        body_md: `# Hinjewadi\n\n${paragraph('hin', 450)}`,
        status: 'reviewed',
        sources: [SRC_A, SRC_B],
      },
      {
        locality_id: 'wakad',
        title: 'Example guide to Wakad',
        body_md: `# Wakad\n\n${paragraph('wak', 120)}`,
        status: 'reviewed',
        sources: [SRC_A],
      },
      {
        locality_id: 'baner',
        title: 'Example guide to Baner',
        body_md: `# Baner\n\n${paragraph('ban', 450)}`,
        status: 'draft',
        sources: [SRC_A],
      },
    ],
    places: places.map((p) => p.place),
    providers: [pv1.row, pv2.row],
    evidence: [...places.flatMap((p) => p.evidence), pv1.evidence, pv2.evidence],
    experiences: [experience],
    recommendations: [],
    featured: [],
    campaigns: [],
    demand: [
      { subject_id: 'terrace-waterproofing', locality_id: 'hinjewadi', score: 8 },
      { subject_id: 'biryani', locality_id: 'hinjewadi', score: 10 },
      { subject_id: 'biryani', locality_id: null, score: 4 },
    ],
    quote_stats: [
      { service_id: 'terrace-waterproofing', locality_id: 'hinjewadi', n: 4, low: 45000, high: 80000 },
    ],
    founding_slots: [],
    prose_reviews: [],
    redirects: [],
    previous_manifest: [],
  };
  return snapshot;
}
