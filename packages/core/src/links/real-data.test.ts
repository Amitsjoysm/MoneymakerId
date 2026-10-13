// The slug-collision checker against the real, committed files under data/ (Node: reads the disk through the T01
// loaders; the checker itself stays pure).
//
// data/services and data/cost-models exist. data/localities.json and data/dishes.json are Wave 1 leftovers that do
// not exist yet: until they do, the localities and dishes are the CONTRACTS §4a ids, and the tests that read those
// two files are skipped (their names say so). They switch on by themselves when the files land.
import { describe, expect, it } from 'vitest';
import { fileExists, loadCostModels, loadDishes, loadLocalities, loadServices } from '../config/index.ts';
import { ALL_SERVICE_IDS, DISH_IDS, LOCALITY_IDS, SUB_LOCALITY_IDS } from '../constants/index.ts';
import { findSlugCollisions, serviceIds } from './collisions.ts';

const HAVE_LOCALITIES = fileExists('data/localities.json');
const HAVE_DISHES = fileExists('data/dishes.json');
const note = (have: boolean, file: string) =>
  have ? file : `${file} (SKIPPED: the file does not exist yet)`;

const SERVICES = serviceIds(loadServices());
const REFERENCE_LOCALITIES = [...LOCALITY_IDS, ...SUB_LOCALITY_IDS];
const REFERENCE_DISHES = [...DISH_IDS];

const show = (collisions: ReturnType<typeof findSlugCollisions>) =>
  collisions.map((c) => `${c.host} ${c.space} ${c.slug} ${c.kind} [${c.claimants.join(', ')}]`);

describe('real data: data/services and data/cost-models', () => {
  it('holds exactly the 12 service ids of CONTRACTS §4a, each once', () => {
    expect([...SERVICES].sort()).toEqual([...ALL_SERVICE_IDS].sort());
  });

  it('every cost model belongs to a service, so its {service}-cost guide slug exists', () => {
    const models = loadCostModels();
    expect(models.length).toBeGreaterThan(0);
    const known = new Set(SERVICES);
    for (const m of models) expect(known.has(m.service_id), `${m.id}: service ${m.service_id}`).toBe(true);
  });

  it('has no slug collision with the localities and dishes of CONTRACTS §4a', () => {
    expect(
      show(
        findSlugCollisions({
          localities: REFERENCE_LOCALITIES,
          dishes: REFERENCE_DISHES,
          services: SERVICES,
        }),
      ),
    ).toEqual([]);
  });
});

describe('real data: localities and dishes', () => {
  it.skipIf(!HAVE_LOCALITIES)(
    `${note(HAVE_LOCALITIES, 'data/localities.json')} has no slug collision`,
    () => {
      const localities = loadLocalities().map((l) => l.id);
      expect(show(findSlugCollisions({ localities, dishes: REFERENCE_DISHES, services: SERVICES }))).toEqual(
        [],
      );
    },
  );

  it.skipIf(!HAVE_DISHES)(`${note(HAVE_DISHES, 'data/dishes.json')} has no slug collision`, () => {
    const dishes = loadDishes().map((d) => d.id);
    expect(
      show(findSlugCollisions({ localities: REFERENCE_LOCALITIES, dishes, services: SERVICES })),
    ).toEqual([]);
  });

  it.skipIf(!HAVE_LOCALITIES || !HAVE_DISHES)(
    `${note(HAVE_LOCALITIES && HAVE_DISHES, 'data/localities.json + data/dishes.json')} together with the services have no slug collision`,
    () => {
      const sets = {
        localities: loadLocalities().map((l) => l.id),
        dishes: loadDishes().map((d) => d.id),
        services: SERVICES,
      };
      expect(show(findSlugCollisions(sets))).toEqual([]);
    },
  );
});
