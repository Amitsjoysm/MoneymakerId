// TEST-ONLY fixtures for @mm/core/locality and @mm/core/intent. Nothing in the package imports this file at run
// time; only *.test.ts files do. It is not data.
//
// - The ids are the CONTRACTS §4a reference ids: 20 localities, 3 sub-localities, 16 parent dishes, 12 services.
// - The two landmarks and their names are invented for the tests.
// - COORDINATES ARE TEST VALUES: rough figures, good enough for ordering distances in tests. They are not
//   sourced, and they are NOT what `data/localities.json` will hold (real coordinates carry a `geo_source`).
// - The aliases are typical misspellings and Hinglish/Marathi spellings, written for the tests. Real aliases come
//   from `data/localities.json` and `data/dishes.json`.
import type { Dish, Locality, ServiceDef } from '../schema/index.ts';

const FIXTURE_SOURCE: Locality['geo_source'] = {
  url: 'https://example.com/test-fixture',
  title: 'Example test fixture',
  publisher: 'Example Publisher',
  retrieved_at: '2026-10-01',
  quote: null,
};

type LocalityOverrides = Partial<Locality> & Pick<Locality, 'id' | 'name' | 'geo'>;

export function makeLocality(o: LocalityOverrides): Locality {
  return {
    kind: 'locality',
    city_id: 'pune',
    parent_id: null,
    aliases: [],
    geo_source: FIXTURE_SOURCE,
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
    ...o,
  };
}

const at = (lat: number, lng: number) => ({ lat, lng });

export const LOCALITIES: Locality[] = [
  makeLocality({
    id: 'hinjewadi',
    name: 'Hinjewadi',
    geo: at(18.5912, 73.7389),
    aliases: ['hinjawadi', 'hinjewdi', 'hinjavadi', 'hinjawdi', 'hinjewadi it park', 'rgip'],
    i18n: { mr: { name: 'हिंजवडी' }, hi: { name: 'हिंजवाड़ी' } },
  }),
  makeLocality({
    id: 'hinjewadi-phase-1',
    name: 'Hinjewadi Phase 1',
    kind: 'sub_locality',
    parent_id: 'hinjewadi',
    geo: at(18.5913, 73.7324),
    aliases: ['hinjawadi phase 1', 'hinjewadi phase i', 'hinjewadi phase one'],
  }),
  makeLocality({
    id: 'hinjewadi-phase-2',
    name: 'Hinjewadi Phase 2',
    kind: 'sub_locality',
    parent_id: 'hinjewadi',
    geo: at(18.5864, 73.7229),
    aliases: ['hinjawadi phase 2', 'hinjewadi phase ii', 'hinjewadi phase two'],
  }),
  makeLocality({
    id: 'hinjewadi-phase-3',
    name: 'Hinjewadi Phase 3',
    kind: 'sub_locality',
    parent_id: 'hinjewadi',
    geo: at(18.5846, 73.6809),
    aliases: ['hinjawadi phase 3', 'hinjewadi phase iii', 'hinjewadi phase three'],
  }),
  makeLocality({
    id: 'wakad',
    name: 'Wakad',
    geo: at(18.5987, 73.7603),
    aliases: ['wakkad', 'vakad', 'wakd'],
    i18n: { mr: { name: 'वाकड' }, hi: { name: 'वाकड' } },
  }),
  makeLocality({
    id: 'baner',
    name: 'Baner',
    geo: at(18.559, 73.7868),
    aliases: ['baaner', 'bener'],
    i18n: { mr: { name: 'बाणेर' }, hi: null },
  }),
  makeLocality({
    id: 'balewadi',
    name: 'Balewadi',
    geo: at(18.577, 73.779),
    aliases: ['balevadi', 'baliwadi'],
  }),
  makeLocality({ id: 'aundh', name: 'Aundh', geo: at(18.558, 73.8077), aliases: ['oundh', 'aundh gaon'] }),
  makeLocality({
    id: 'kothrud',
    name: 'Kothrud',
    geo: at(18.5074, 73.8077),
    aliases: ['kothrood', 'kothrod', 'cothrud'],
    i18n: { mr: { name: 'कोथरूड' }, hi: null },
  }),
  makeLocality({
    id: 'viman-nagar',
    name: 'Viman Nagar',
    geo: at(18.5679, 73.9143),
    aliases: ['vimannagar', 'vimaan nagar', 'viman nager'],
  }),
  makeLocality({
    id: 'kharadi',
    name: 'Kharadi',
    geo: at(18.5515, 73.9348),
    aliases: ['kharedi', 'kharadee'],
    i18n: { mr: { name: 'खराडी' }, hi: null },
  }),
  makeLocality({
    id: 'hadapsar',
    name: 'Hadapsar',
    geo: at(18.5089, 73.9259),
    aliases: ['hadpsar', 'hadapsar gaon'],
  }),
  makeLocality({
    id: 'koregaon-park',
    name: 'Koregaon Park',
    geo: at(18.5362, 73.894),
    aliases: ['kp', 'koregoan park', 'koregaon prk'],
  }),
  makeLocality({
    id: 'shivajinagar',
    name: 'Shivajinagar',
    geo: at(18.5308, 73.8475),
    aliases: ['shivaji nagar', 'shivajinagr'],
  }),
  makeLocality({
    id: 'camp',
    name: 'Camp',
    geo: at(18.5126, 73.88),
    aliases: ['pune camp'],
    jurisdiction: 'cantonment',
  }),
  makeLocality({
    id: 'kondhwa',
    name: 'Kondhwa',
    geo: at(18.4637, 73.8878),
    aliases: ['kondwa', 'kondhawa'],
  }),
  makeLocality({ id: 'wagholi', name: 'Wagholi', geo: at(18.58, 73.98), aliases: ['wagoli', 'vagholi'] }),
  makeLocality({
    id: 'lohegaon',
    name: 'Lohegaon',
    geo: at(18.599, 73.92),
    aliases: ['lohgaon', 'lohagaon'],
  }),
  makeLocality({
    id: 'pimple-saudagar',
    name: 'Pimple Saudagar',
    geo: at(18.5985, 73.795),
    aliases: ['pimplesaudagar', 'pimple soudagar'],
    jurisdiction: 'PCMC',
  }),
  makeLocality({
    id: 'pimple-nilakh',
    name: 'Pimple Nilakh',
    geo: at(18.59, 73.785),
    aliases: ['pimplenilakh', 'pimple nilakh gaon'],
    jurisdiction: 'PCMC',
  }),
  makeLocality({
    id: 'pimpri',
    name: 'Pimpri',
    geo: at(18.6279, 73.8009),
    aliases: ['pimpri colony'],
    jurisdiction: 'PCMC',
  }),
  makeLocality({
    id: 'chinchwad',
    name: 'Chinchwad',
    geo: at(18.6448, 73.796),
    aliases: ['chinchvad', 'chinchwadgaon'],
    jurisdiction: 'PCMC',
  }),
  makeLocality({
    id: 'magarpatta',
    name: 'Magarpatta',
    geo: at(18.5146, 73.9267),
    aliases: ['magarpatta city', 'magarpata'],
  }),
  // Landmarks: ids start with `near-`, each has a parent. The second one hangs off a sub-locality.
  makeLocality({
    id: 'near-hinjewadi-metro',
    name: 'Hinjewadi Metro Station',
    kind: 'landmark',
    parent_id: 'hinjewadi',
    geo: at(18.5921, 73.7366),
    aliases: ['hinjewadi metro'],
  }),
  makeLocality({
    id: 'near-example-chowk',
    name: 'Example Chowk',
    kind: 'landmark',
    parent_id: 'hinjewadi-phase-2',
    geo: at(18.5872, 73.7241),
    aliases: [],
  }),
  makeLocality({
    id: 'near-wakad-bridge',
    name: 'Wakad Bridge',
    kind: 'landmark',
    parent_id: 'wakad',
    geo: at(18.5985, 73.7656),
    aliases: ['wakad flyover'],
  }),
];

type DishOverrides = Partial<Dish> & Pick<Dish, 'id' | 'name'>;

export function makeDish(o: DishOverrides): Dish {
  return {
    parent_id: null,
    aliases: [],
    cravings: [],
    diet: 'both',
    price_bands_inr: [100, 200],
    price_sanity_inr: { min: 10, max: 1000 },
    description: 'Example description for a test fixture.',
    prose_status: 'draft',
    i18n: { mr: null, hi: null },
    ...o,
  };
}

export const DISHES: Dish[] = [
  makeDish({ id: 'biryani', name: 'Biryani', aliases: ['biriyani', 'briyani', 'biryaani', 'dum biryani'] }),
  makeDish({ id: 'samosa', name: 'Samosa', aliases: ['samosas', 'samose'] }),
  makeDish({
    id: 'vada-pav',
    name: 'Vada Pav',
    aliases: ['vadapav', 'wada pav', 'wadapav', 'vada paav', 'vada pao'],
    diet: 'veg',
    i18n: { mr: { name: 'वडापाव' }, hi: null },
  }),
  makeDish({
    id: 'misal-pav',
    name: 'Misal Pav',
    aliases: ['misal', 'misalpav', 'misal paav'],
    diet: 'veg',
    i18n: { mr: { name: 'मिसळ पाव' }, hi: null },
  }),
  makeDish({ id: 'momos', name: 'Momos', aliases: ['momo', 'momoz'] }),
  makeDish({ id: 'dosa', name: 'Dosa', aliases: ['dosai', 'dhosa'], diet: 'veg' }),
  makeDish({ id: 'pizza', name: 'Pizza', aliases: ['pizzas', 'piza'] }),
  makeDish({ id: 'burger', name: 'Burger', aliases: ['burgers', 'burgar'] }),
  makeDish({ id: 'poha', name: 'Poha', aliases: ['pohe'], diet: 'veg', cravings: ['breakfast'] }),
  makeDish({
    id: 'pav-bhaji',
    name: 'Pav Bhaji',
    aliases: ['pavbhaji', 'paav bhaji', 'pav bhaaji'],
    diet: 'veg',
  }),
  makeDish({
    id: 'shawarma',
    name: 'Shawarma',
    aliases: ['shwarma', 'shawerma', 'shawarama'],
    diet: 'non_veg',
  }),
  makeDish({
    id: 'chole-bhature',
    name: 'Chole Bhature',
    aliases: ['chole bhatura', 'chhole bhature', 'cholebhature'],
    diet: 'veg',
  }),
  makeDish({ id: 'thali', name: 'Thali', aliases: ['thaali'], cravings: ['filling'] }),
  makeDish({ id: 'kebab', name: 'Kebab', aliases: ['kabab', 'kebabs', 'kabob'], diet: 'non_veg' }),
  makeDish({ id: 'sandwich', name: 'Sandwich', aliases: ['sandwiches', 'sandwitch'] }),
  makeDish({ id: 'desserts', name: 'Desserts', aliases: ['dessert'], cravings: ['sweet'] }),
];

type ServiceOverrides = Partial<ServiceDef> & Pick<ServiceDef, 'id' | 'name'>;

function makeService(o: ServiceOverrides): ServiceDef {
  return {
    parent_id: null,
    unit: 'sqft',
    area_presets: [],
    scope_options: [],
    materials: [],
    duration_days: null,
    questions_to_ask: [],
    common_mistakes: [],
    quote_checklist: [],
    faq: [],
    prose_status: 'draft',
    sub_services: [],
    ...o,
  };
}

const sub = (parent: string, id: string, name: string, unit: ServiceDef['unit'] = 'sqft') =>
  makeService({ id, name, parent_id: parent, unit });

/** The five top-level services with their sub-services nested (the shape of `data/services/*.json`). */
export const SERVICES: ServiceDef[] = [
  makeService({
    id: 'waterproofing',
    name: 'Waterproofing',
    sub_services: [
      sub('waterproofing', 'terrace-waterproofing', 'Terrace waterproofing'),
      sub('waterproofing', 'bathroom-waterproofing', 'Bathroom waterproofing'),
      sub('waterproofing', 'external-wall-waterproofing', 'External wall waterproofing'),
      sub('waterproofing', 'basement-waterproofing', 'Basement waterproofing'),
      sub('waterproofing', 'leakage-repair', 'Leakage repair', 'unit'),
    ],
  }),
  makeService({
    id: 'painting',
    name: 'House painting',
    sub_services: [
      sub('painting', 'interior-painting', 'Interior painting'),
      sub('painting', 'exterior-painting', 'Exterior painting'),
    ],
  }),
  makeService({ id: 'bathroom-renovation', name: 'Bathroom Renovation', unit: 'unit' }),
  makeService({ id: 'modular-kitchen', name: 'Modular Kitchen', unit: 'unit' }),
  makeService({ id: 'house-construction', name: 'House Construction' }),
];

/** Service aliases (a `ServiceDef` has no alias field). The shape `parseIntent` takes as `serviceAliases`. */
export const SERVICE_ALIASES: Record<string, string[]> = {
  waterproofing: ['water proofing', 'damp proofing', 'dampproofing'],
  'terrace-waterproofing': ['roof waterproofing', 'terrace leakage', 'terrace water proofing'],
  'bathroom-waterproofing': ['toilet waterproofing', 'washroom waterproofing'],
  'leakage-repair': ['leak repair', 'leakage', 'seepage repair'],
  painting: ['house paint', 'home painting', 'wall painting'],
  'bathroom-renovation': ['bathroom remodel', 'toilet renovation', 'washroom renovation'],
  'modular-kitchen': ['modular kitchen design', 'kitchen modular'],
  'house-construction': ['home construction', 'building a house', 'ghar bandhkam'],
};

/** Everything `parseIntent` needs, built from the fixtures. */
export const REFS = {
  localities: LOCALITIES,
  dishes: DISHES,
  services: SERVICES,
  serviceAliases: SERVICE_ALIASES,
};
