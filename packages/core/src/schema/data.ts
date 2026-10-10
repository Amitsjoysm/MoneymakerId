// Curated data files: shapes and per-record invariants (CONTRACTS §4, and `locality_guides` from §6).
//
// These describe files we author (`data/**`, `content/locality-guides/*.md`), so objects are strict: a typo
// in a key is an error, not silently dropped. Every factual statement carries `SourceRef[]`. Optional data is
// `null`, never missing (CONTRACTS §1). Rules that span records (symmetric neighbours, a cost model's service
// existing) are checked by the data tests, not here.
import { z } from 'zod';
import {
  AreaPresetSchema,
  CostUnitSchema,
  CravingSchema,
  DietSchema,
  JurisdictionSchema,
  LeadGradeSchema,
  LocalityKindSchema,
  ProseStatusSchema,
  TierSchema,
} from './enums.ts';
import {
  GeoSchema,
  HttpsUrlSchema,
  InrSchema,
  IsoDateSchema,
  ReferenceIdSchema,
  SlugSchema,
  TextSchema,
} from './primitives.ts';

type CheckContext = z.core.ParsePayload;

/** Adds a custom issue at `path` from inside a `.check()` callback. */
export function addIssue(ctx: CheckContext, message: string, path: PropertyKey[] = []): void {
  ctx.issues.push({ code: 'custom', message, path, input: ctx.value });
}

// --- SourceRef and LocalFact --------------------------------------------------------------------------------

export const SourceRefSchema = z.strictObject({
  url: HttpsUrlSchema,
  title: TextSchema,
  publisher: TextSchema,
  retrieved_at: IsoDateSchema,
  quote: TextSchema.nullable(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const LocalFactTopicSchema = z.enum([
  'housing_stock',
  'building_age',
  'water',
  'soil',
  'rainfall',
  'rules',
  'access',
  'demand',
  'other',
]);
export type LocalFactTopic = z.infer<typeof LocalFactTopicSchema>;

export const LocalFactSchema = z.strictObject({
  id: SlugSchema,
  topic: LocalFactTopicSchema,
  text: TextSchema,
  /** Every service id (top-level or sub) the fact is relevant to. */
  services: z.array(SlugSchema),
  sources: z.array(SourceRefSchema).min(1),
  status: ProseStatusSchema,
});
export type LocalFact = z.infer<typeof LocalFactSchema>;

// --- data/localities.json -----------------------------------------------------------------------------------

const LocalityNameI18nSchema = z.strictObject({ name: TextSchema }).nullable();

export const LocalitySchema = z
  .strictObject({
    id: ReferenceIdSchema,
    name: TextSchema,
    kind: LocalityKindSchema,
    city_id: z.literal('pune'),
    parent_id: SlugSchema.nullable(),
    /** Misspellings, Marathi/Hindi spellings, "Hinjawadi". */
    aliases: z.array(TextSchema),
    geo: GeoSchema,
    geo_source: SourceRefSchema,
    jurisdiction: JurisdictionSchema,
    pincodes: z.array(z.string().regex(/^[1-9]\d{5}$/, 'must be a 6-digit pincode')),
    /** Ids, at most 6, symmetric (the data test checks symmetry). */
    neighbours: z.array(SlugSchema).max(6),
    landmarks: z.array(TextSchema),
    commercial_centres: z.array(TextSchema),
    office_clusters: z.array(TextSchema),
    residential_clusters: z.array(TextSchema),
    /** At least 3 per (priority locality x top-level service) for gate path (c); the coverage script checks it. */
    construction_facts: z.array(LocalFactSchema),
    food_notes: z.array(LocalFactSchema),
    i18n: z.strictObject({ mr: LocalityNameI18nSchema, hi: LocalityNameI18nSchema }),
  })
  .check((ctx) => {
    const l = ctx.value;
    if (l.kind === 'landmark') {
      if (!l.id.startsWith('near-')) addIssue(ctx, 'a landmark id must start with "near-"', ['id']);
      if (l.parent_id === null) addIssue(ctx, 'a landmark needs a parent locality', ['parent_id']);
    }
    if (l.kind === 'sub_locality' && l.parent_id === null) {
      addIssue(ctx, 'a sub-locality needs a parent locality', ['parent_id']);
    }
  });
export type Locality = z.infer<typeof LocalitySchema>;

/** The staging files `data/sources/locality-facts-*.json`: facts by locality id, merged into localities later. */
export const LocalityFactsStagingSchema = z.record(SlugSchema, z.array(LocalFactSchema));
export type LocalityFactsStaging = z.infer<typeof LocalityFactsStagingSchema>;

// --- data/dishes.json ---------------------------------------------------------------------------------------

export const DishSchema = z
  .strictObject({
    id: ReferenceIdSchema,
    name: TextSchema,
    parent_id: SlugSchema.nullable(),
    aliases: z.array(TextSchema),
    cravings: z.array(CravingSchema),
    diet: DietSchema,
    /** Price band edges in rupees, strictly increasing. */
    price_bands_inr: z.array(InrSchema),
    price_sanity_inr: z.strictObject({ min: InrSchema, max: InrSchema }),
    description: TextSchema,
    prose_status: ProseStatusSchema,
    i18n: z.strictObject({ mr: LocalityNameI18nSchema, hi: LocalityNameI18nSchema }),
  })
  .check((ctx) => {
    const d = ctx.value;
    if (d.price_sanity_inr.min >= d.price_sanity_inr.max) {
      addIssue(ctx, 'price_sanity_inr.min must be below max', ['price_sanity_inr']);
    }
    if (d.price_bands_inr.some((p, i) => i > 0 && p <= d.price_bands_inr[i - 1]!)) {
      addIssue(ctx, 'price_bands_inr must be strictly increasing', ['price_bands_inr']);
    }
  });
export type Dish = z.infer<typeof DishSchema>;

// --- data/services/{service_id}.json ------------------------------------------------------------------------

const AreaPresetEntrySchema = z.strictObject({
  preset: AreaPresetSchema,
  label: TextSchema,
  quantity: z.number().positive(),
  assumption: TextSchema,
  sources: z.array(SourceRefSchema).min(1),
});

const ServiceDefBaseSchema = z.strictObject({
  id: ReferenceIdSchema,
  name: TextSchema,
  parent_id: SlugSchema.nullable(),
  unit: CostUnitSchema,
  /** May be empty: the calculator then asks for a custom quantity. */
  area_presets: z.array(AreaPresetEntrySchema),
  scope_options: z.array(z.strictObject({ id: SlugSchema, label: TextSchema, description: TextSchema })),
  materials: z.array(
    z.strictObject({
      id: SlugSchema,
      label: TextSchema,
      description: TextSchema,
      sources: z.array(SourceRefSchema).min(1),
    }),
  ),
  /** `null` when unsourced; pages then hide it. */
  duration_days: z
    .strictObject({ min: z.number().int().positive(), max: z.number().int().positive(), basis: TextSchema })
    .nullable(),
  questions_to_ask: z.array(TextSchema),
  common_mistakes: z.array(TextSchema),
  quote_checklist: z.array(TextSchema),
  faq: z.array(z.strictObject({ q: TextSchema, a: TextSchema })),
  prose_status: ProseStatusSchema,
  get sub_services() {
    return z.array(ServiceDefBaseSchema);
  },
});

export type ServiceDef = z.infer<typeof ServiceDefBaseSchema>;

/** Per-node rules, applied to the whole tree from the outermost schema (a refinement would break recursion). */
function checkServiceNode(ctx: CheckContext, node: ServiceDef, path: PropertyKey[]): void {
  if (node.duration_days && node.duration_days.min > node.duration_days.max) {
    addIssue(ctx, 'duration_days.min must not exceed max', [...path, 'duration_days']);
  }
  node.sub_services.forEach((sub, i) => {
    const subPath = [...path, 'sub_services', i];
    if (sub.parent_id !== node.id) {
      addIssue(ctx, `parent_id must be "${node.id}"`, [...subPath, 'parent_id']);
    }
    checkServiceNode(ctx, sub, subPath);
  });
}

export const ServiceDefSchema = ServiceDefBaseSchema.check((ctx) => checkServiceNode(ctx, ctx.value, []));

/** One file per top-level service: no parent. */
export const TopLevelServiceSchema = ServiceDefSchema.check((ctx) => {
  if (ctx.value.parent_id !== null) addIssue(ctx, 'a service file holds a top-level service', ['parent_id']);
});

// --- data/cost-models/{service_id}.json ---------------------------------------------------------------------

export const CostComponentsSchema = z.strictObject({
  materials: z.number().min(0).max(1),
  labour: z.number().min(0).max(1),
  preparation: z.number().min(0).max(1),
  repair: z.number().min(0).max(1),
  transport: z.number().min(0).max(1),
  waste: z.number().min(0).max(1),
});
export type CostComponents = z.infer<typeof CostComponentsSchema>;

export const RateRangeSchema = z
  .strictObject({ low: InrSchema, expected: InrSchema, high: InrSchema })
  .check((ctx) => {
    const { low, expected, high } = ctx.value;
    if (!(low <= expected && expected <= high)) addIssue(ctx, 'must satisfy low <= expected <= high');
  });
export type RateRange = z.infer<typeof RateRangeSchema>;

export const CostModelSchema = z
  .strictObject({
    id: SlugSchema,
    service_id: SlugSchema,
    scope_id: SlugSchema.nullable(),
    material_id: SlugSchema.nullable(),
    tier: TierSchema,
    unit: CostUnitSchema,
    /** Per unit. */
    rate_inr: RateRangeSchema,
    min_job_inr: InrSchema.nullable(),
    /** Share of the rate by component; sums to 1 within 0.01. */
    components: CostComponentsSchema,
    locality_factors: z.array(
      z.strictObject({
        locality_id: SlugSchema,
        factor: z.number().positive(),
        sources: z.array(SourceRefSchema).min(1),
      }),
    ),
    /** At least 2, from at least 2 different publishers. */
    sources: z.array(SourceRefSchema).min(2),
    reviewed_at: IsoDateSchema,
    valid_until: IsoDateSchema,
    status: ProseStatusSchema,
    notes: z.string(),
  })
  .check((ctx) => {
    const m = ctx.value;
    const total = Object.values(m.components).reduce((a, b) => a + b, 0);
    // The epsilon keeps a sum of exactly 1.01 (1 + 0.01 in floating point) valid.
    if (Math.abs(total - 1) > 0.01 + 1e-9) addIssue(ctx, `components sum to ${total}, expected 1 +/- 0.01`, ['components']);
    const publishers = new Set(m.sources.map((s) => s.publisher.trim().toLowerCase()));
    if (publishers.size < 2) addIssue(ctx, 'sources must come from at least 2 different publishers', ['sources']);
    if (m.valid_until < m.reviewed_at) addIssue(ctx, 'valid_until is before reviewed_at', ['valid_until']);
  });
export type CostModel = z.infer<typeof CostModelSchema>;

// --- content/locality-guides/{locality_id}.md ---------------------------------------------------------------

export const LocalityGuideFrontmatterSchema = z.strictObject({
  locality_id: SlugSchema,
  title: TextSchema,
  status: ProseStatusSchema,
  word_count: z.number().int().positive(),
  sources: z.array(SourceRefSchema).min(1),
});
export type LocalityGuideFrontmatter = z.infer<typeof LocalityGuideFrontmatterSchema>;

/** A guide as the catalogue snapshot carries it (CONTRACTS §6). */
export const LocalityGuideSchema = z.strictObject({
  locality_id: SlugSchema,
  title: TextSchema,
  body_md: TextSchema,
  status: ProseStatusSchema,
  sources: z.array(SourceRefSchema).min(1),
});
export type LocalityGuide = z.infer<typeof LocalityGuideSchema>;

// --- data/seasonal-calendar.json, lead-pricing.json, aggregators.json ---------------------------------------

export const MonthKeySchema = z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);

export const SeasonalCalendarSchema = z.strictObject({
  months: z.record(
    MonthKeySchema,
    z.strictObject({
      services: z.array(SlugSchema),
      headline: TextSchema,
      cta: TextSchema,
      module: TextSchema.nullable(),
    }),
  ),
});
export type SeasonalCalendar = z.infer<typeof SeasonalCalendarSchema>;

export const LeadPricingSchema = z.strictObject({
  currency: z.literal('INR'),
  exclusive_multiplier: z.number().positive(),
  prices: z.array(z.strictObject({ service_id: SlugSchema, grade: LeadGradeSchema, price_inr: InrSchema })),
});
export type LeadPricing = z.infer<typeof LeadPricingSchema>;

export const AggregatorEntrySchema = z.strictObject({
  /** A registrable domain, lowercase, no scheme or path. */
  domain: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/),
  owner_group: SlugSchema,
  discovery_only: z.literal(true),
});
export type AggregatorEntry = z.infer<typeof AggregatorEntrySchema>;
