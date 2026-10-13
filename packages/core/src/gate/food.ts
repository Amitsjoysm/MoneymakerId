// Page candidates of food.marketmindai.com (CONTRACTS §11): dish pages for the city and for each locality, locality
// hubs, and the whitelisted intent pages. Plan §5 gate table: a place counts for a dish page only with fresh,
// grounded evidence for that dish and either a first-hand visit or two independent publishers. Place profile pages
// (/place/{slug}/) are not enumerated here: they are outside this card's page list.
import type {
  EvidenceView,
  ExperienceView,
  OpeningHours,
  PageCandidate,
  PlaceView,
} from '../schema/index.ts';
import { FoodIntentSchema, LocalityFoodIntentSchema } from '../schema/index.ts';
import { compareText, sortedById, type Catalogue } from './catalogue.ts';
import { dishInputs, factInputs, placeInputs } from './inputs.ts';
import { demandIndex, meanFill, rowFreshness, seoInputs } from './seo-inputs.ts';
import { joinText } from './text.ts';

const HOST = 'food';
const CITY_URL = '/pune/';
/** A price at or below this proves "budget food" on a locality page. An editorial threshold the owner can tune. */
export const BUDGET_FOOD_MAX_INR = 300;
/** Late-night means verified closing time after this clock time (plan §5). */
const LATE_NIGHT_AFTER = '23:00';
/** A food page counts as fully covered at this many places and claims (the data_quality scale). */
const WELL_COVERED = { places: 5, claims: 10 } as const;
/** The named (non-band) dish intents: whatever `FoodIntentSchema` allows besides `under-{band}`. */
export const DISH_INTENTS = FoodIntentSchema.options[1].options;

interface PlaceState {
  place: PlaceView;
  /** The place's locality and its ancestors, nearest first. */
  lineage: string[];
  /** Live, non-aggregator evidence rows about the place. */
  rows: EvidenceView[];
  visits: ExperienceView[];
  /** A first-hand visit or at least two independent publishers (plan §5). */
  trusted: boolean;
}

function publisherKey(source: EvidenceView['source']): string | null {
  const publisher = source.publisher?.trim().toLowerCase();
  if (publisher) return publisher;
  if (source.url === null) return null;
  try {
    return new URL(source.url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function placeStates(cat: Catalogue): PlaceState[] {
  return cat.places.flatMap((place) => {
    const lineage = cat.lineage(place.locality_id);
    if (lineage.length === 0) return [];
    const rows = cat.live.get(place.id) ?? [];
    const visits = cat.visits.get(place.id) ?? [];
    const publishers = new Set(rows.map((r) => publisherKey(r.source)).filter((k) => k !== null));
    const firstHand = visits.length > 0 || rows.some((r) => r.source.kind === 'first_hand');
    return [{ place, lineage, rows, visits, trusted: firstHand || publishers.size >= 2 }];
  });
}

/** The dish a `price` or `dish` row is about. */
function dishIdOf(row: EvidenceView): string | null {
  const claim = row.claim;
  if ('price' in claim) return claim.price.dish_id;
  if ('dish' in claim) return claim.dish.dish_id;
  return null;
}

const lists = (s: PlaceState, dishId: string): boolean => s.place.dishes.some((d) => d.dish_id === dishId);
const dishRows = (s: PlaceState, dishId: string): EvidenceView[] =>
  s.rows.filter((r) => dishIdOf(r) === dishId);
const qualifies = (s: PlaceState, dishId: string): boolean => s.trusted && dishRows(s, dishId).length > 0;

function priceRows(s: PlaceState, dishId: string | null): EvidenceView[] {
  return s.rows.filter((r) => {
    if (!('price' in r.claim) || r.claim.price.dish_id === null) return false;
    return dishId === null || r.claim.price.dish_id === dishId;
  });
}

function closesLate(hours: OpeningHours): boolean {
  return Object.values(hours).some((intervals) =>
    intervals?.some(([open, close]) => close > LATE_NIGHT_AFTER || close <= open),
  );
}

const lateHoursRows = (s: PlaceState): EvidenceView[] =>
  s.rows.filter((r) => 'hours' in r.claim && closesLate(r.claim.hours));

/**
 * The rows that prove an intent for a place: a dated price within the band, verified hours past 23:00, a diet flag or
 * a family / office tag (plan §5). A flag proof has no row, so it returns an empty list; no proof returns null.
 */
function proofRows(intent: string, s: PlaceState, dishId: string | null): EvidenceView[] | null {
  const some = (rows: EvidenceView[]): EvidenceView[] | null => (rows.length > 0 ? rows : null);
  switch (intent) {
    case 'veg':
    case 'veg-food':
      return s.place.diet === 'veg' ? [] : null;
    case 'family':
    case 'office-lunch':
      return s.place.tags.some((t) => t.trim().toLowerCase() === intent) ? [] : null;
    case 'late-night':
    case 'late-night-food':
      return some(lateHoursRows(s));
    case 'budget-food':
      return some(
        priceRows(s, null).filter(
          (r) => 'price' in r.claim && r.claim.price.price_inr <= BUDGET_FOOD_MAX_INR,
        ),
      );
    default: {
      const band = Number(intent.slice('under-'.length));
      return some(priceRows(s, dishId).filter((r) => 'price' in r.claim && r.claim.price.price_inr <= band));
    }
  }
}

interface Proof {
  places: PlaceState[];
  /** The rows that prove it; a flag proof counts as one piece of evidence per place. */
  rows: EvidenceView[];
  evidence: number;
}

function prove(intent: string, base: readonly PlaceState[], dishId: string | null): Proof {
  const proof: Proof = { places: [], rows: [], evidence: 0 };
  for (const s of base) {
    const rows = proofRows(intent, s, dishId);
    if (rows === null) continue;
    proof.places.push(s);
    proof.rows.push(...rows);
    proof.evidence += Math.max(1, rows.length);
  }
  return proof;
}

const visitNotes = (s: PlaceState, dishId: string): string[] =>
  s.visits.flatMap((v) => [v.notes, ...v.dishes.filter((d) => d.dish_id === dishId).map((d) => d.notes)]);
const quotes = (rows: readonly EvidenceView[]): string[] => rows.map((r) => r.supporting_quote ?? '');

const dishText = (s: PlaceState, dishId: string): string =>
  joinText([s.place.name, ...quotes(dishRows(s, dishId)), ...visitNotes(s, dishId)]);
const placeText = (s: PlaceState): string =>
  joinText([s.place.name, s.place.cuisines.join(', '), ...quotes(s.rows)]);

const idsOf = (places: readonly PlaceState[]): string[] => places.map((s) => s.place.id);
const mergeRows = (...lists: EvidenceView[][]): EvidenceView[] =>
  sortedById([...new Map(lists.flat().map((r) => [r.id, r])).values()]);

export function foodCandidates(cat: Catalogue): PageCandidate[] {
  const out: PageCandidate[] = [];
  const demand = demandIndex(cat.snapshot.demand);
  const states = placeStates(cat);
  const localityById = new Map(cat.localities.map((l) => [l.id, l]));

  const placesIn = new Map<string, PlaceState[]>();
  for (const s of states) {
    for (const id of s.lineage) placesIn.set(id, [...(placesIn.get(id) ?? []), s]);
  }
  const localityIds = [...placesIn.keys()].sort(compareText);

  const quality = (places: number, claims: number): number =>
    meanFill([
      [places, WELL_COVERED.places],
      [claims, WELL_COVERED.claims],
    ]);

  for (const localityId of localityIds) {
    const locality = localityById.get(localityId)!;
    const here = placesIn.get(localityId)!;
    const hubPlaces = here.filter((s) => s.rows.length > 0);

    // --- /pune/{locality}/ ---
    const hubRows = hubPlaces.flatMap((s) => s.rows);
    const hubText = joinText([...locality.food_notes.map((f) => f.text), ...hubPlaces.map(placeText)]);
    out.push({
      url: `/pune/${localityId}/`,
      host: HOST,
      locale: 'en',
      page_type: 'locality_hub',
      parent_url: CITY_URL,
      entity_ids: idsOf(hubPlaces),
      evidence_count: hubRows.length,
      entity_count: hubPlaces.length,
      relevance: hubPlaces.length / here.length,
      main_text: hubText,
      data_inputs: {
        locality: { id: localityId, name: locality.name, food_notes: factInputs(locality.food_notes) },
        places: hubPlaces.map((s) => placeInputs(s.place, s.rows, s.visits, null)),
      },
      prose_keys: locality.food_notes.length > 0 ? [`locality:${localityId}:facts`] : [],
      seo_inputs: seoInputs({
        key: 'food:locality_hub',
        demand: demand.locality(localityId),
        data_quality: quality(hubPlaces.length, hubRows.length),
        local: true,
        freshness: rowFreshness(hubRows, cat.now),
        text: hubText,
      }),
      extra: {},
    });

    // --- /pune/{locality}/{late-night-food,budget-food,veg-food}/ ---
    for (const intent of LocalityFoodIntentSchema.options) {
      const proof = prove(intent, hubPlaces, null);
      if (proof.places.length === 0) continue;
      const text = joinText(proof.places.map(placeText));
      out.push({
        url: `/pune/${localityId}/${intent}/`,
        host: HOST,
        locale: 'en',
        page_type: 'locality_food_intent',
        parent_url: `/pune/${localityId}/`,
        entity_ids: idsOf(proof.places),
        evidence_count: proof.evidence,
        entity_count: proof.places.length,
        relevance: 1,
        main_text: text,
        data_inputs: {
          intent,
          locality: { id: localityId, name: locality.name },
          places: proof.places.map((s) => placeInputs(s.place, s.rows, s.visits, null)),
        },
        prose_keys: [],
        seo_inputs: seoInputs({
          key: 'food:locality_food_intent',
          demand: demand.locality(localityId),
          data_quality: quality(proof.places.length, proof.evidence),
          local: true,
          freshness: rowFreshness(
            proof.places.flatMap((s) => s.rows),
            cat.now,
          ),
          text,
        }),
        extra: {},
      });
    }
  }

  for (const dish of cat.dishes) {
    const listing = states.filter((s) => lists(s, dish.id));
    if (listing.length === 0) continue;
    const dishKey = [`dish:${dish.id}`];

    // --- /pune/{dish}/ ---
    const cityQualified = listing.filter((s) => qualifies(s, dish.id));
    const cityRows = cityQualified.flatMap((s) => dishRows(s, dish.id));
    const cityText = joinText(cityQualified.map((s) => dishText(s, dish.id)));
    const spread = new Set(cityQualified.map((s) => s.lineage[s.lineage.length - 1]!));
    out.push({
      url: `/pune/${dish.id}/`,
      host: HOST,
      locale: 'en',
      page_type: 'dish_city',
      parent_url: CITY_URL,
      entity_ids: idsOf(cityQualified),
      evidence_count: cityRows.length,
      entity_count: cityQualified.length,
      relevance: cityQualified.length / listing.length,
      main_text: cityText,
      data_inputs: {
        dish: dishInputs(dish),
        places: cityQualified.map((s) => placeInputs(s.place, dishRows(s, dish.id), s.visits, dish.id)),
      },
      prose_keys: dishKey,
      seo_inputs: seoInputs({
        key: 'food:dish_city',
        demand: demand.subjects([dish.id], null),
        data_quality: quality(cityQualified.length, cityRows.length),
        local: false,
        freshness: rowFreshness(cityRows, cat.now),
        text: cityText,
      }),
      extra: { localities: spread.size },
    });

    for (const localityId of localityIds) {
      const locality = localityById.get(localityId)!;
      const listed = placesIn.get(localityId)!.filter((s) => lists(s, dish.id));
      if (listed.length === 0) continue;

      // --- /pune/{locality}/{dish}/ ---
      const qualified = listed.filter((s) => qualifies(s, dish.id));
      const rows = qualified.flatMap((s) => dishRows(s, dish.id));
      const text = joinText(qualified.map((s) => dishText(s, dish.id)));
      out.push({
        url: `/pune/${localityId}/${dish.id}/`,
        host: HOST,
        locale: 'en',
        page_type: 'dish_locality',
        parent_url: `/pune/${localityId}/`,
        entity_ids: idsOf(qualified),
        evidence_count: rows.length,
        entity_count: qualified.length,
        relevance: qualified.length / listed.length,
        main_text: text,
        data_inputs: {
          dish: dishInputs(dish),
          locality: { id: localityId, name: locality.name },
          places: qualified.map((s) => placeInputs(s.place, dishRows(s, dish.id), s.visits, dish.id)),
        },
        prose_keys: dishKey,
        seo_inputs: seoInputs({
          key: 'food:dish_locality',
          demand: demand.subjects([dish.id], localityId),
          data_quality: quality(qualified.length, rows.length),
          local: true,
          freshness: rowFreshness(rows, cat.now),
          text,
        }),
        extra: {},
      });

      // --- /pune/{locality}/{dish}/{intent}/ ---
      const bands = [...new Set(dish.price_bands_inr)].sort((a, b) => a - b);
      for (const intent of [...bands.map((b) => `under-${b}`), ...DISH_INTENTS]) {
        const proof = prove(intent, qualified, dish.id);
        if (proof.places.length === 0) continue;
        const intentText = joinText(proof.places.map((s) => dishText(s, dish.id)));
        out.push({
          url: `/pune/${localityId}/${dish.id}/${intent}/`,
          host: HOST,
          locale: 'en',
          page_type: 'food_intent',
          parent_url: `/pune/${localityId}/${dish.id}/`,
          entity_ids: idsOf(proof.places),
          evidence_count: proof.evidence,
          entity_count: proof.places.length,
          relevance: 1,
          main_text: intentText,
          data_inputs: {
            intent,
            dish: dishInputs(dish),
            locality: { id: localityId, name: locality.name },
            places: proof.places.map((s) =>
              placeInputs(
                s.place,
                mergeRows(
                  dishRows(s, dish.id),
                  proof.rows.filter((r) => r.entity_id === s.place.id),
                ),
                s.visits,
                dish.id,
              ),
            ),
          },
          prose_keys: dishKey,
          seo_inputs: seoInputs({
            key: 'food:food_intent',
            demand: demand.subjects([dish.id], localityId),
            data_quality: quality(proof.places.length, proof.evidence),
            local: true,
            freshness: rowFreshness(
              proof.places.flatMap((s) => dishRows(s, dish.id)),
              cat.now,
            ),
            text: intentText,
          }),
          extra: {},
        });
      }
    }
  }

  return out;
}
