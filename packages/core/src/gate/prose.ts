// The prose review rule (CONTRACTS §8): a prose key counts as reviewed when `prose_reviews` says so OR the source
// record it names is itself `reviewed`. Unknown keys are not reviewed, so a typo cannot publish AI-drafted text.
import type { CatalogueSnapshot, ServiceDef } from '../schema/index.ts';

type ProseSnapshot = Pick<
  CatalogueSnapshot,
  'services' | 'cost_models' | 'dishes' | 'localities' | 'locality_guides' | 'prose_reviews'
>;

function collectServices(nodes: readonly ServiceDef[], into: Map<string, boolean>): void {
  for (const node of nodes) {
    into.set(node.id, node.prose_status === 'reviewed');
    collectServices(node.sub_services, into);
  }
}

const RECORD_KEY = /^(service|cost_model|dish):(.+)$/;
const LOCALITY_KEY = /^locality:([^:]+):(guide|facts)$/;

/**
 * `reviewed(key)` for the keys of CONTRACTS §8:
 * `service:{id}`, `cost_model:{id}`, `dish:{id}`, `locality:{id}:guide`, `locality:{id}:facts` (every fact of the
 * locality, construction facts and food notes alike, and at least one), and `i18n:{locale}:{url}` (M6: only
 * `prose_reviews` can vouch for a translated page).
 */
export function proseReviewed(snapshot: ProseSnapshot): (key: string) => boolean {
  const byReview = new Set(snapshot.prose_reviews.filter((r) => r.status === 'reviewed').map((r) => r.key));

  const services = new Map<string, boolean>();
  collectServices(snapshot.services, services);
  const models = new Map(snapshot.cost_models.map((m) => [m.id, m.status === 'reviewed']));
  const dishes = new Map(snapshot.dishes.map((d) => [d.id, d.prose_status === 'reviewed']));
  const guides = new Map(snapshot.locality_guides.map((g) => [g.locality_id, g.status === 'reviewed']));
  const facts = new Map(
    snapshot.localities.map((l) => {
      const all = [...l.construction_facts, ...l.food_notes];
      return [l.id, all.length > 0 && all.every((f) => f.status === 'reviewed')];
    }),
  );
  const records = { service: services, cost_model: models, dish: dishes } as const;

  return (key) => {
    if (byReview.has(key)) return true;
    const record = RECORD_KEY.exec(key);
    if (record) return records[record[1] as keyof typeof records].get(record[2]!) ?? false;
    const locality = LOCALITY_KEY.exec(key);
    if (locality) return (locality[2] === 'guide' ? guides : facts).get(locality[1]!) ?? false;
    return false;
  };
}
