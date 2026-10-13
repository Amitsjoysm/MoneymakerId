// Projections of catalogue records into a page's `data_inputs` (what `content_hash` is computed from). Each keeps what
// a visitor can see on the page and drops what cannot change it: review state (a page does not change when its prose
// is marked reviewed), paid placement, internal confidence scores and extractor versions.
import type {
  CostModel,
  Dish,
  EvidenceView,
  ExperienceView,
  LocalFact,
  PlaceView,
  ProviderView,
  ServiceDef,
} from '../schema/index.ts';
import { compareText, sortedById } from './catalogue.ts';

export function factInputs(facts: readonly LocalFact[]) {
  return [...facts].sort((a, b) => compareText(a.id, b.id)).map(({ status: _status, ...shown }) => shown);
}

export function dishInputs(dish: Dish) {
  const { prose_status: _status, ...shown } = dish;
  return shown;
}

export function serviceInputs(def: ServiceDef) {
  const { prose_status: _status, sub_services, ...shown } = def;
  return { ...shown, sub_services: sub_services.map((sub) => ({ id: sub.id, name: sub.name })) };
}

/** A cost model as shown. With a locality, only that locality's factor (a rate change elsewhere is not news here). */
export function modelInputs(model: CostModel, localityId: string | null) {
  const { status: _status, locality_factors, ...shown } = model;
  if (localityId === null) return { ...shown, locality_factors };
  return { ...shown, locality_factor: locality_factors.find((f) => f.locality_id === localityId) ?? null };
}

export function providerInputs(providers: readonly ProviderView[]) {
  return sortedById(providers).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    locality_id: p.locality_id,
    service_localities: p.service_localities,
    services: p.services,
    specializations: p.specializations,
    experience_years: p.experience_years,
    verification_status: p.verification_status,
    verified_at: p.verified_at,
  }));
}

export function rowInputs(rows: readonly EvidenceView[]) {
  return sortedById(rows).map((r) => ({
    id: r.id,
    claim_type: r.claim_type,
    claim: r.claim,
    supporting_quote: r.supporting_quote,
    source: { kind: r.source.kind, url: r.source.url, title: r.source.title, publisher: r.source.publisher },
    retrieved_at: r.retrieved_at,
    valid_until: r.valid_until,
  }));
}

export function visitInputs(visits: readonly ExperienceView[], dishId: string | null) {
  return sortedById(visits).map(({ prose_status: _status, dishes, ...shown }) => ({
    ...shown,
    dishes: dishId === null ? dishes : dishes.filter((d) => d.dish_id === dishId),
  }));
}

export function placeInputs(
  place: PlaceView,
  rows: readonly EvidenceView[],
  visits: readonly ExperienceView[],
  dishId: string | null,
) {
  const { auto_published: _auto, reviewed_at: _reviewed, dishes, ...shown } = place;
  return {
    ...shown,
    dishes: dishId === null ? dishes : dishes.filter((d) => d.dish_id === dishId),
    evidence: rowInputs(rows),
    visits: visitInputs(visits, dishId),
  };
}
