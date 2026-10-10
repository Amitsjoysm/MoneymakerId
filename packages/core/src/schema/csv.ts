// CSV templates (CONTRACTS §6): the exact header rows and a typed schema for one data row of each.
//
// A row schema reads the raw cells of one record (every value a string, keyed by header) and returns typed
// values: `|` splits multi-value cells, an empty optional cell becomes `null`, numbers and booleans are
// parsed. P05 (`mm import:csv`) parses the file with `parseCsvRecords` (@mm/core/config), skips rows for
// which `isExampleRow` is true, validates the rest with these schemas and reports failures by line number.
import { z } from 'zod';
import { deepFreeze } from '../constants/freeze.ts';
import { addIssue, LocalFactTopicSchema } from './data.ts';
import { OpeningHoursSchema, type OpeningHours } from './derived.ts';
import { BusinessKindSchema, DietSchema, ServiceModeSchema, WeekdaySchema } from './enums.ts';
import { HttpsUrlSchema, IsoDateSchema, SlugSchema } from './primitives.ts';

export const CSV_HEADERS = deepFreeze({
  places: [
    'name',
    'kind',
    'locality_id',
    'address',
    'lat',
    'lng',
    'phone',
    'website',
    'cuisines',
    'diet',
    'price_level',
    'service_modes',
    'opening_hours',
    'tags',
    'source_url',
    'retrieved_at',
    'valid_until',
  ],
  place_dishes: [
    'place_name',
    'locality_id',
    'dish_id',
    'variant_label',
    'price_inr',
    'source_url',
    'retrieved_at',
    'valid_until',
  ],
  providers: [
    'name',
    'locality_id',
    'address',
    'phone',
    'website',
    'services',
    'service_localities',
    'specializations',
    'experience_years',
    'accepts_leads',
    'min_job_inr',
    'source_url',
    'retrieved_at',
  ],
  experiences: [
    'place_name',
    'locality_id',
    'visited_at',
    'dish_id',
    'price_paid_inr',
    'rating',
    'would_recommend',
    'tags',
    'notes',
  ],
  local_facts: [
    'locality_id',
    'topic',
    'services',
    'text',
    'source_url',
    'source_title',
    'publisher',
    'retrieved_at',
  ],
  // data/demand.csv
  demand: [
    'service_or_dish',
    'sub_id',
    'locality_id',
    'monthly_searches',
    'est_lead_value_inr',
    'data_ready',
    'source',
  ],
} as const);

/** "A data row whose first field starts with EXAMPLE is skipped." */
export function isExampleRow(cells: readonly string[]): boolean {
  return cells[0]?.startsWith('EXAMPLE') ?? false;
}

// --- cell helpers --------------------------------------------------------------------------------------------

const text = z.string().trim().min(1);
const optionalText = z.string().transform((s) => (s.trim() === '' ? null : s.trim()));

/** An empty cell is `null`; otherwise the cell must satisfy `inner`. */
function optional<T extends z.ZodType>(inner: T) {
  return z
    .string()
    .transform((s) => (s.trim() === '' ? null : s.trim()))
    .pipe(inner.nullable());
}

/** A `|`-separated cell. Empty gives `[]`. */
function list<T extends z.ZodType>(item: T) {
  return z
    .string()
    .transform((s) =>
      s
        .split('|')
        .map((x) => x.trim())
        .filter((x) => x !== ''),
    )
    .pipe(z.array(item));
}

const wholeNumber = z
  .string()
  .trim()
  .regex(/^\d+$/, 'must be a whole number')
  .transform(Number);
const decimal = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, 'must be a number')
  .transform(Number);
const boolean = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

/** `https://…` for a published source, `visited` for first-hand, `owner` for owner-entered. */
const sourceCell = z.union([HttpsUrlSchema, z.literal('visited'), z.literal('owner')]);

/**
 * Reads `mon=11:00-23:30;tue=11:00-15:00|18:00-23:00` into the `OpeningHours` shape (a `|` separates a day's
 * ranges). An empty cell is `null`. Throws an `Error` that names the offending part when the cell is malformed.
 */
export function parseOpeningHoursCell(cell: string): OpeningHours | null {
  const raw = cell.trim();
  if (raw === '') return null;
  const hours: Record<string, [string, string][]> = {};
  for (const part of raw.split(';')) {
    const m = /^([a-z]+)=(.+)$/.exec(part.trim());
    const day = m ? WeekdaySchema.safeParse(m[1]) : null;
    if (!m || !day?.success) throw new Error(`opening_hours: cannot read "${part.trim()}" (expected day=HH:MM-HH:MM)`);
    if (day.data in hours) throw new Error(`opening_hours: ${day.data} appears twice`);
    hours[day.data] = m[2]!.split('|').map((range) => {
      const r = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(range.trim());
      if (!r) throw new Error(`opening_hours: cannot read "${range.trim()}" (expected HH:MM-HH:MM)`);
      return [r[1]!, r[2]!];
    });
  }
  const parsed = OpeningHoursSchema.safeParse(hours);
  if (!parsed.success) throw new Error(`opening_hours: "${raw}" has an invalid time`);
  return parsed.data;
}

const openingHoursCell = z.string().transform((s, ctx) => {
  try {
    return parseOpeningHoursCell(s);
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: (e as Error).message });
    return z.NEVER;
  }
});

// --- row schemas ---------------------------------------------------------------------------------------------

export const PlaceRowSchema = z
  .strictObject({
    name: text,
    kind: BusinessKindSchema,
    locality_id: SlugSchema,
    address: optionalText,
    lat: optional(decimal.pipe(z.number().min(-90).max(90))),
    lng: optional(decimal.pipe(z.number().min(-180).max(180))),
    phone: optionalText,
    website: optional(HttpsUrlSchema),
    cuisines: list(text),
    diet: optional(DietSchema),
    price_level: optional(wholeNumber.pipe(z.number().min(1).max(3))),
    service_modes: list(ServiceModeSchema),
    opening_hours: openingHoursCell,
    tags: list(text),
    source_url: sourceCell,
    retrieved_at: IsoDateSchema,
    valid_until: optional(IsoDateSchema),
  })
  .check((ctx) => {
    if ((ctx.value.lat === null) !== (ctx.value.lng === null)) {
      addIssue(ctx, 'lat and lng must both be set or both be empty', ['lat']);
    }
  });
export type PlaceRow = z.infer<typeof PlaceRowSchema>;

export const PlaceDishRowSchema = z.strictObject({
  place_name: text,
  locality_id: SlugSchema,
  dish_id: SlugSchema,
  variant_label: optionalText,
  price_inr: optional(wholeNumber),
  source_url: sourceCell,
  retrieved_at: IsoDateSchema,
  valid_until: optional(IsoDateSchema),
});
export type PlaceDishRow = z.infer<typeof PlaceDishRowSchema>;

export const ProviderRowSchema = z.strictObject({
  name: text,
  locality_id: SlugSchema,
  address: optionalText,
  phone: optionalText,
  website: optional(HttpsUrlSchema),
  services: list(SlugSchema).pipe(z.array(SlugSchema).min(1)),
  service_localities: list(SlugSchema),
  specializations: list(text),
  experience_years: optional(wholeNumber),
  accepts_leads: boolean,
  min_job_inr: optional(wholeNumber),
  source_url: sourceCell,
  retrieved_at: IsoDateSchema,
});
export type ProviderRow = z.infer<typeof ProviderRowSchema>;

export const ExperienceRowSchema = z.strictObject({
  place_name: text,
  locality_id: SlugSchema,
  visited_at: IsoDateSchema,
  dish_id: optional(SlugSchema),
  price_paid_inr: optional(wholeNumber),
  rating: wholeNumber.pipe(z.number().min(1).max(5)),
  would_recommend: boolean,
  tags: list(text),
  notes: z.string().trim(),
});
export type ExperienceRow = z.infer<typeof ExperienceRowSchema>;

export const LocalFactRowSchema = z.strictObject({
  locality_id: SlugSchema,
  topic: LocalFactTopicSchema,
  services: list(SlugSchema),
  text: text,
  /** A fact needs a real published source, so `visited` and `owner` are not accepted here. */
  source_url: HttpsUrlSchema,
  source_title: text,
  publisher: text,
  retrieved_at: IsoDateSchema,
});
export type LocalFactRow = z.infer<typeof LocalFactRowSchema>;

export const DemandRowSchema = z.strictObject({
  service_or_dish: SlugSchema,
  sub_id: optional(SlugSchema),
  locality_id: SlugSchema,
  /** Empty means unknown. */
  monthly_searches: optional(wholeNumber),
  est_lead_value_inr: wholeNumber,
  data_ready: z.enum(['0', '1']).transform((v) => v === '1'),
  source: text,
});
export type DemandRow = z.infer<typeof DemandRowSchema>;

/** Header row and row schema for each template, by name. */
export const CSV_TEMPLATES = {
  places: { header: CSV_HEADERS.places, row: PlaceRowSchema },
  place_dishes: { header: CSV_HEADERS.place_dishes, row: PlaceDishRowSchema },
  providers: { header: CSV_HEADERS.providers, row: ProviderRowSchema },
  experiences: { header: CSV_HEADERS.experiences, row: ExperienceRowSchema },
  local_facts: { header: CSV_HEADERS.local_facts, row: LocalFactRowSchema },
  demand: { header: CSV_HEADERS.demand, row: DemandRowSchema },
} as const;
