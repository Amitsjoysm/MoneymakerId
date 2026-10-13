import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ParsedIntentSchema } from '../schema/index.ts';
import type { ParsedIntent } from '../schema/index.ts';
import { DISHES, LOCALITIES, makeLocality, REFS, SERVICES } from '../locality/fixtures.ts';
import { resolveLocality } from '../locality/resolve.ts';
import { parseIntent } from './parse.ts';

type Fields = Pick<
  ParsedIntent,
  'vertical' | 'subject_id' | 'craving' | 'locality_id' | 'budget_inr' | 'diet' | 'open_now'
>;
type Extra = Partial<Pick<Fields, 'craving' | 'budget_inr' | 'diet' | 'open_now'>>;

/** One table row: the query and every field the parse must give. Unlisted extras default to null / false. */
const row = (
  vertical: Fields['vertical'],
  query: string,
  subject: string | null,
  locality: string | null,
  extra: Extra = {},
): [string, Fields] => [
  query,
  {
    vertical,
    subject_id: subject,
    craving: null,
    locality_id: locality,
    budget_inr: null,
    diet: null,
    open_now: false,
    ...extra,
  },
];
const food = (q: string, subject: string | null, locality: string | null, extra?: Extra) =>
  row('food', q, subject, locality, extra);
const build = (q: string, subject: string | null, locality: string | null, extra?: Extra) =>
  row('construction', q, subject, locality, extra);

const parse = (q: string) => parseIntent(q, REFS);

function check(rows: [string, Fields][]) {
  it.each(rows)('%j', (query, expected) => {
    const got = parse(query);
    expect(ParsedIntentSchema.parse(got)).toEqual(got);
    expect({
      vertical: got.vertical,
      subject_id: got.subject_id,
      craving: got.craving,
      locality_id: got.locality_id,
      budget_inr: got.budget_inr,
      diet: got.diet,
      open_now: got.open_now,
    }).toEqual(expected);
  });
}

describe('parseIntent: dishes and localities', () => {
  check([
    food('biryani', 'biryani', null),
    food('Biryani near Wakad', 'biryani', 'wakad'),
    food('biryani in wakad pune', 'biryani', 'wakad'),
    food('best biryani in kharadi', 'biryani', 'kharadi'),
    food('samosa near hadapsar', 'samosa', 'hadapsar'),
    food('vada pav in baner', 'vada-pav', 'baner'),
    food('misal pav near hinjewadi', 'misal-pav', 'hinjewadi'),
    food('momos in viman nagar', 'momos', 'viman-nagar'),
    food('dosa near kothrud', 'dosa', 'kothrud'),
    food('pizza in koregaon park', 'pizza', 'koregaon-park'),
    food('burger near magarpatta', 'burger', 'magarpatta'),
    food('poha in aundh', 'poha', 'aundh'),
    food('pav bhaji near camp', 'pav-bhaji', 'camp'),
    food('shawarma in kondhwa', 'shawarma', 'kondhwa'),
    food('chole bhature near shivajinagar', 'chole-bhature', 'shivajinagar'),
    food('thali in wagholi', 'thali', 'wagholi'),
    food('kebab near lohegaon', 'kebab', 'lohegaon'),
    food('sandwich in balewadi', 'sandwich', 'balewadi'),
    food('desserts near pimpri', 'desserts', 'pimpri'),
    food('biryani chinchwad', 'biryani', 'chinchwad'),
    food('biryani near hinjewadi phase 2', 'biryani', 'hinjewadi-phase-2'),
    food('wakad', null, 'wakad'),
  ]);
});

describe('parseIntent: misspellings and alternative spellings', () => {
  check([
    food('biriyani near wakkad', 'biryani', 'wakad'),
    food('briyani hinjawadi', 'biryani', 'hinjewadi'),
    food('bryani wakad', 'biryani', 'wakad'),
    food('kharadi biryaani', 'biryani', 'kharadi'),
    food('vadapav in pimple saudagar', 'vada-pav', 'pimple-saudagar'),
    food('wada pav near kothrood', 'vada-pav', 'kothrud'),
    food('misal in hinjewdi', 'misal-pav', 'hinjewadi'),
    food('momo near kharedi', 'momos', 'kharadi'),
    food('momoz hadapsar', 'momos', 'hadapsar'),
    food('mommos in kothrud', 'momos', 'kothrud'),
    food('dosai near aundh', 'dosa', 'aundh'),
    food('shwarma near kothrud', 'shawarma', 'kothrud'),
    food('shawerma baner', 'shawarma', 'baner'),
    food('kabab in wagholi', 'kebab', 'wagholi'),
    food('sandwitch near baner', 'sandwich', 'baner'),
    food('pizzas in viman nager', 'pizza', 'viman-nagar'),
    food('burgar in kharadi', 'burger', 'kharadi'),
    food('chole bhatura near hadapsar', 'chole-bhature', 'hadapsar'),
    food('cholebhature wakad', 'chole-bhature', 'wakad'),
    food('pavbhaji in vimannagar', 'pav-bhaji', 'viman-nagar'),
    food('pav bhaaji near koregaon prk', 'pav-bhaji', 'koregaon-park'),
    food('samose near camp', 'samosa', 'camp'),
    food('dessert in magarpatta city', 'desserts', 'magarpatta'),
    food('biryani near KP', 'biryani', 'koregaon-park'),
    food('KP pizza', 'pizza', 'koregaon-park'),
    food('pimplesaudagar misal', 'misal-pav', 'pimple-saudagar'),
    food('Pimple-Saudagar thali', 'thali', 'pimple-saudagar'),
    food('Pimple Nilakh dosa', 'dosa', 'pimple-nilakh'),
  ]);
});

describe('parseIntent: Hinglish and Marathi', () => {
  check([
    food('wakad ke paas accha biryani chahiye', 'biryani', 'wakad'),
    food('baner me sasta pizza chahiye', 'pizza', 'baner'),
    food('hinjewadi jawal misal kuthe milel', 'misal-pav', 'hinjewadi'),
    food('kothrud madhe vada pav kuthe milto', 'vada-pav', 'kothrud'),
    food('viman nagar mein accha shawarma batao', 'shawarma', 'viman-nagar'),
    food('mala wakad jawal pizza pahije', 'pizza', 'wakad'),
    food('kothrud madhe changla misal kuthe aahe', 'misal-pav', 'kothrud'),
    food('pune me sasta samosa kahan milega', 'samosa', null),
    food('misal pav ka bhav kiti', 'misal-pav', null),
    food('vada pav kiti la', 'vada-pav', null),
    food('sasta aur accha poha', 'poha', null),
    food('kharadi me veg thali chahiye', 'thali', 'kharadi', { diet: 'veg' }),
    food('hadapsar ke paas pure veg dosa', 'dosa', 'hadapsar', { diet: 'veg' }),
    food('wakad me non veg biryani', 'biryani', 'wakad', { diet: 'non_veg' }),
    food('nonveg kebab near baner', 'kebab', 'baner', { diet: 'non_veg' }),
    food('jain thali in kothrud', 'thali', 'kothrud', { diet: 'veg' }),
    food('abhi khula hai wakad me biryani', 'biryani', 'wakad', { open_now: true }),
    food('abhi biryani chahiye near baner', 'biryani', 'baner', { open_now: true }),
    food('teekha misal near wakad', 'misal-pav', 'wakad', { craving: 'spicy' }),
    food('nashta in kothrud', null, 'kothrud', { craving: 'breakfast' }),
    food('meetha near camp', null, 'camp', { craving: 'sweet' }),
    food('raat ko biryani near baner', 'biryani', 'baner', { craving: 'late_night' }),
    food('वाकड मध्ये वडापाव', 'vada-pav', 'wakad'),
    food('हिंजवडी मध्ये मिसळ पाव', 'misal-pav', 'hinjewadi'),
  ]);
});

describe('parseIntent: Roman numerals and locality names that contain a neutral word', () => {
  check([
    food('biryani hinjewadi phase i', 'biryani', 'hinjewadi-phase-1'),
    food('biryani hinjewadi phase ii', 'biryani', 'hinjewadi-phase-2'),
    food('biryani hinjewadi phase iii', 'biryani', 'hinjewadi-phase-3'),
    food('Biryani near Hinjewadi Phase I, Pune', 'biryani', 'hinjewadi-phase-1'),
    food('I want biryani near hinjewadi phase I', 'biryani', 'hinjewadi-phase-1'),
    food('hinjewadi phase i ke paas accha biryani chahiye', 'biryani', 'hinjewadi-phase-1'),
    food('where can I find a good biryani at Hinjewadi Phase I please', 'biryani', 'hinjewadi-phase-1'),
    food('i need pizza in wakad', 'pizza', 'wakad'), // the pronoun "I" alone names nothing
    build('terrace waterproofing cost hinjewadi phase i', 'terrace-waterproofing', 'hinjewadi-phase-1'),
  ]);

  const WITH_NEUTRAL_NAMES = {
    ...REFS,
    localities: [
      ...LOCALITIES,
      makeLocality({
        id: 'head-chowk',
        name: 'Head Chowk',
        geo: { lat: 1, lng: 1 },
        aliases: ['head circle'],
      }),
      makeLocality({ id: 'sector-a', name: 'Sector A', geo: { lat: 1, lng: 2 } }),
      makeLocality({ id: 'popular-colony', name: 'Popular Colony', geo: { lat: 1, lng: 3 } }),
      makeLocality({ id: 'sasta-bazaar', name: 'Sasta Bazaar', geo: { lat: 1, lng: 4 } }),
    ],
  };

  it.each([
    ['biryani near head chowk', 'head-chowk'],
    ['head circle pizza', 'head-chowk'],
    ['pizza in sector a', 'sector-a'],
    ['a good pizza in sector a please', 'sector-a'],
    ['biryani popular colony', 'popular-colony'],
    ['sasta biryani near sasta bazaar chahiye', 'sasta-bazaar'],
  ])('finds a locality whose name has a word that is otherwise ignored: %j -> %s', (q, id) => {
    expect(parseIntent(q, WITH_NEUTRAL_NAMES).locality_id).toBe(id);
    expect(resolveLocality(q, WITH_NEUTRAL_NAMES.localities)?.locality_id).toBe(id);
  });

  it('matches such a name exactly, not as a typo of a shorter one', () => {
    expect(parseIntent('sector a', WITH_NEUTRAL_NAMES)).toMatchObject({
      locality_id: 'sector-a',
      confidence: 0.3,
    });
    expect(parseIntent('hinjewadi phase i', WITH_NEUTRAL_NAMES)).toMatchObject({
      locality_id: 'hinjewadi-phase-1',
      confidence: 0.3,
    });
  });

  it('still ignores those words everywhere else in a query', () => {
    expect(parseIntent('popular biryani near wakad', WITH_NEUTRAL_NAMES)).toMatchObject({
      subject_id: 'biryani',
      locality_id: 'wakad',
    });
    expect(parseIntent('cheap biryani head', WITH_NEUTRAL_NAMES).locality_id).toBeNull();
  });
});

describe('parseIntent: agrees with resolveLocality on every name and alias of every fixture locality', () => {
  const forms = LOCALITIES.flatMap((l) =>
    [l.name, l.id.replaceAll('-', ' '), ...l.aliases, l.i18n.mr?.name, l.i18n.hi?.name]
      .filter((f): f is string => typeof f === 'string')
      .map((f): [string, string] => [l.id, f]),
  );

  it('covers a useful number of forms', () => {
    expect(forms.length).toBeGreaterThan(100);
  });

  it.each(forms)('%s: %j', (id, form) => {
    const direct = resolveLocality(form, LOCALITIES)?.locality_id;
    expect(direct, 'resolveLocality').toBe(id);
    expect(parse(form).locality_id, 'parseIntent on the form alone').toBe(direct);
    expect(parse(`biryani near ${form}`).locality_id, 'parseIntent in a sentence').toBe(direct);
  });
});

describe('parseIntent: a partial locality name is not guessed', () => {
  check([
    food('biryani pimple', 'biryani', null),
    food('best biryani near Pimple, Pune', 'biryani', null),
    food('pimple', null, null),
    food('biryani pimple saudagar', 'biryani', 'pimple-saudagar'),
    food('biryani pimple saudgar', 'biryani', 'pimple-saudagar'),
    food('biryani pimple nilakh', 'biryani', 'pimple-nilakh'),
    food('biryani pimpri', 'biryani', 'pimpri'),
    food('biryani pimpry', 'biryani', 'pimpri'),
    build('terrace waterproofing pimple', 'terrace-waterproofing', null),
  ]);
});

describe('parseIntent: budget', () => {
  check([
    food('biryani under 200', 'biryani', null, { budget_inr: 200 }),
    food('biryani under 300 near wakad', 'biryani', 'wakad', { budget_inr: 300 }),
    food('pizza ₹200 baner', 'pizza', 'baner', { budget_inr: 200 }),
    food('dosa 100 rs near kothrud', 'dosa', 'kothrud', { budget_inr: 100 }),
    food('misal 150 ke andar hinjewadi', 'misal-pav', 'hinjewadi', { budget_inr: 150 }),
    food('thali under ₹250 in hadapsar', 'thali', 'hadapsar', { budget_inr: 250 }),
    food('burger below 150', 'burger', null, { budget_inr: 150 }),
    food('biryani less than 400', 'biryani', null, { budget_inr: 400 }),
    food('samosa upto 50', 'samosa', null, { budget_inr: 50 }),
    food('vada pav within 30 rupees', 'vada-pav', null, { budget_inr: 30 }),
    food('momos budget 100', 'momos', null, { budget_inr: 100 }),
    food('pizza rs.300 viman nagar', 'pizza', 'viman-nagar', { budget_inr: 300 }),
    food('shawarma 120/- near kondhwa', 'shawarma', 'kondhwa', { budget_inr: 120 }),
    food('kebab 250 tak lohegaon', 'kebab', 'lohegaon', { budget_inr: 250 }),
    food('misal 100 paryant near kothrud', 'misal-pav', 'kothrud', { budget_inr: 100 }),
    food('pav bhaji maximum 120', 'pav-bhaji', null, { budget_inr: 120 }),
    food('biryani under 1,000', 'biryani', null, { budget_inr: 1000 }),
    food('thali under 1k', 'thali', null, { budget_inr: 1000 }),
    food('biryani under २००', 'biryani', null, { budget_inr: 200 }),
    food('sasta biryani 200 ke andar wakad me', 'biryani', 'wakad', { budget_inr: 200 }),
  ]);
});

describe('parseIntent: cravings, diet and "open now"', () => {
  check([
    food('late night biryani near wakad', 'biryani', 'wakad', { craving: 'late_night' }),
    food('late night food in baner', null, 'baner', { craving: 'late_night' }),
    food('midnight pizza baner', 'pizza', 'baner', { craving: 'late_night' }),
    food('spicy misal in kothrud', 'misal-pav', 'kothrud', { craving: 'spicy' }),
    food('sweet dessert in baner', 'desserts', 'baner', { craving: 'sweet' }),
    food('breakfast poha near aundh', 'poha', 'aundh', { craving: 'breakfast' }),
    food('light dinner near hinjewadi', null, 'hinjewadi', { craving: 'light' }),
    food('street food wakad', null, 'wakad', { craving: 'street' }),
    food('healthy sandwich kothrud', 'sandwich', 'kothrud', { craving: 'healthy' }),
    food('heavy lunch in kharadi', null, 'kharadi', { craving: 'filling' }),
    food('namkeen near hadapsar', null, 'hadapsar', { craving: 'savoury' }),
    food('veg biryani in wakad', 'biryani', 'wakad', { diet: 'veg' }),
    food('pure veg restaurant near baner', null, 'baner', { diet: 'veg' }),
    food('veg and non veg thali', 'thali', null, { diet: 'both' }),
    food('egg biryani near hadapsar', 'biryani', 'hadapsar', { diet: 'egg' }),
    food('non-veg shawarma baner', 'shawarma', 'baner', { diet: 'non_veg' }),
    food('vegetarian pizza in kothrud', 'pizza', 'kothrud', { diet: 'veg' }),
    food('jain food near hadapsar', null, 'hadapsar', { diet: 'veg' }),
    food('non veg near kharadi', null, 'kharadi', { diet: 'non_veg' }),
    food('open now pizza in baner', 'pizza', 'baner', { open_now: true }),
    food('biryani open now near kharadi', 'biryani', 'kharadi', { open_now: true }),
    food('right now biryani wakad', 'biryani', 'wakad', { open_now: true }),
    food('late night open now biryani baner', 'biryani', 'baner', { open_now: true, craving: 'late_night' }),
    food('open biryani', 'biryani', null), // "open" alone is not "open now"
  ]);

  it('reads "late night" as a craving only: it does not set open_now (decision recorded in the C01 report)', () => {
    expect(parse('late night biryani near wakad')).toMatchObject({ craving: 'late_night', open_now: false });
  });
});

describe('parseIntent: construction', () => {
  check([
    build('terrace waterproofing cost in wakad', 'terrace-waterproofing', 'wakad'),
    build('waterproofing cost', 'waterproofing', null),
    build('waterproofing rate per sq ft pune', 'waterproofing', null),
    build('waterprofing cost baner', 'waterproofing', 'baner'),
    build('terace waterproofing in hinjewadi', 'terrace-waterproofing', 'hinjewadi'),
    build('leakage repair in wakad', 'leakage-repair', 'wakad'),
    build('leakage repair near kharadi', 'leakage-repair', 'kharadi'),
    build('bathroom waterproofing baner', 'bathroom-waterproofing', 'baner'),
    build('external wall waterproofing cost kothrud', 'external-wall-waterproofing', 'kothrud'),
    build('basement waterproofing in hadapsar', 'basement-waterproofing', 'hadapsar'),
    build('interior painting cost viman nagar', 'interior-painting', 'viman-nagar'),
    build('exterior painting rate per sq ft kothrud', 'exterior-painting', 'kothrud'),
    build('painting contractor in wakad', 'painting', 'wakad'),
    build('paint contractor baner', 'painting', 'baner'),
    build('house painting cost kharadi', 'painting', 'kharadi'),
    build('painting 3 bhk flat kharadi', 'painting', 'kharadi'),
    build('painting quote hinjewadi phase 1', 'painting', 'hinjewadi-phase-1'),
    build('bathroom renovation cost in baner', 'bathroom-renovation', 'baner'),
    build('bathroom renovation kharch kiti', 'bathroom-renovation', null),
    build('modular kitchen cost wakad', 'modular-kitchen', 'wakad'),
    build('modular kitchan in baner', 'modular-kitchen', 'baner'),
    build('kitchen modular price hadapsar', 'modular-kitchen', 'hadapsar'),
    build('house construction cost per sq ft in wagholi', 'house-construction', 'wagholi'),
    build('house construction contractor pune', 'house-construction', null),
    build('home construction wakad', 'house-construction', 'wakad'),
    build('ghar bandhkam kharch kiti', 'house-construction', null),
    build('roof waterproofing wakad', 'terrace-waterproofing', 'wakad'),
    build('terrace waterproofing cha bhav kiti', 'terrace-waterproofing', null),
    build('wakad me waterproofing ka rate', 'waterproofing', 'wakad'),
    build('toilet waterproofing wakad', 'bathroom-waterproofing', 'wakad'),
    build('damp proofing cost baner', 'waterproofing', 'baner'),
    build('bathroom remodel cost kothrud', 'bathroom-renovation', 'kothrud'),
    build('washroom renovation baner', 'bathroom-renovation', 'baner'),
    build('leak repair near me', 'leakage-repair', null),
    build('Waterproofing contractor Wakad Pune', 'waterproofing', 'wakad'),
    build('terrace waterproofing in Hinjewadi Phase 2', 'terrace-waterproofing', 'hinjewadi-phase-2'),
    build('waterproofing near example chowk', 'waterproofing', 'near-example-chowk'),
    build('terrace waterproofing 1200 sqft hinjewadi', 'terrace-waterproofing', 'hinjewadi'),
    build('waterproofing under 50000', 'waterproofing', null, { budget_inr: 50000 }),
    build('bathroom renovation under 2 lakh', 'bathroom-renovation', null, { budget_inr: 200000 }),
    build('modular kitchen under 3 lakh pune', 'modular-kitchen', null, { budget_inr: 300000 }),
    build('interior painting rs 20 per sq ft', 'interior-painting', null), // a rate, not a budget
    build('contractor near baner', null, 'baner'),
    build('cost per sq ft', null, null),
    build('bathroom', null, null), // two services share the word: construction, but which one is unknown
  ]);
});

describe('parseIntent: the vertical', () => {
  it('lets a dish outweigh a cost word, and a service outweigh a food word', () => {
    expect(parse('pav bhaji cost')).toMatchObject({ vertical: 'food', subject_id: 'pav-bhaji' });
    expect(parse('waterproofing near the restaurant')).toMatchObject({
      vertical: 'construction',
      subject_id: 'waterproofing',
    });
  });

  it('uses a service only for construction and a dish only for food', () => {
    expect(parse('biryani house painting')).toMatchObject({
      vertical: 'construction',
      subject_id: 'painting',
    });
  });

  it('does not take "house" in "biryani house" for a service word', () => {
    expect(parse('biryani house near wakad')).toMatchObject({
      vertical: 'food',
      subject_id: 'biryani',
      locality_id: 'wakad',
    });
  });
});

describe('parseIntent: empty and unrecognised text', () => {
  check([
    food('', null, null),
    food('   ', null, null),
    food('hello', null, null),
    food('xyz 123', null, null),
    food('pune', null, null),
    food('near me', null, null),
    food('?!', null, null),
  ]);

  it('gives confidence 0 and the bare key "food" when nothing is recognised', () => {
    for (const q of ['', 'hello', 'xyz 123', 'pune']) {
      expect(parse(q)).toMatchObject({ confidence: 0, intent_key: 'food' });
    }
  });

  it('does not take short words for a locality', () => {
    expect(parse('damp wall repair').locality_id).toBeNull();
    expect(parse('came to eat').locality_id).toBeNull();
  });
});

describe('parseIntent: normalisation', () => {
  check([
    food('BIRYANI NEAR WAKAD!!!', 'biryani', 'wakad'),
    food('Ｂｉｒｙａｎｉ ｎｅａｒ ｗａｋａｄ', 'biryani', 'wakad'),
    food('biryani   near\twakad\n', 'biryani', 'wakad'),
    food('  biryani,near,wakad  ', 'biryani', 'wakad'),
  ]);
});

describe('parseIntent: confidence', () => {
  const conf = (q: string) => parse(q).confidence;

  it('adds up: 0.5 for the subject, 0.3 for the locality, 0.1 for a vertical signal, 0.1 for a budget or "open now"', () => {
    expect(conf('biryani')).toBe(0.5);
    expect(conf('wakad')).toBe(0.3);
    expect(conf('biryani near wakad')).toBe(0.8);
    expect(conf('terrace waterproofing cost in wakad')).toBe(0.9);
    expect(conf('open now veg biryani near wakad under 300')).toBe(1);
  });

  it('scales the subject and locality shares by how sure the match was', () => {
    expect(conf('bryani wakad')).toBe(0.7); // biryani one edit off: 0.5 * 0.8 + 0.3
    expect(conf('biryani hadapsr')).toBe(0.74); // hadapsar one edit off: 0.5 + 0.3 * 0.8
  });

  it('stays within 0..1', () => {
    for (const q of ['biryani', 'wakad under 99 veg late night open now biryani', 'x']) {
      expect(conf(q)).toBeGreaterThanOrEqual(0);
      expect(conf(q)).toBeLessThanOrEqual(1);
    }
  });
});

describe('parseIntent: intent_key', () => {
  const key = (q: string) => parse(q).intent_key;

  it('is the example from the brief', () => {
    expect(key('open now veg biryani near wakad under 300')).toBe('food|biryani|wakad|under-300|veg|open');
  });

  it('puts the fields in a fixed order, uses "-" for a gap and drops trailing gaps', () => {
    expect(key('biryani')).toBe('food|biryani');
    expect(key('wakad')).toBe('food|-|wakad');
    expect(key('veg thali')).toBe('food|thali|-|-|veg');
    expect(key('late night biryani')).toBe('food|biryani|-|-|-|-|late_night');
    expect(key('')).toBe('food');
    expect(key('terrace waterproofing cost in wakad')).toBe('construction|terrace-waterproofing|wakad');
    expect(key('waterproofing under 50000')).toBe('construction|waterproofing|-|under-50000');
  });

  it.each([
    [
      [
        'biryani near wakad under 300 veg',
        'Veg Biriyani in Wakkad, Pune ₹300 tak',
        'wakad me veg biryani 300 ke andar',
      ],
    ],
    [['terrace waterproofing cost in wakad', 'wakad terace waterproofing rate', 'roof waterproofing wakad']],
    [['misal pav near hinjewadi', 'hinjawadi jawal misal', 'misalpav in hinjewdi pune']],
    [['pizza open now baner', 'baner pizza abhi', 'Baner: pizza (open now)']],
  ])('gives one key to wordings that mean the same: %j', (queries) => {
    const keys = queries.map(key);
    expect(new Set(keys).size).toBe(1);
  });

  it.each([
    ['biryani near wakad', 'biryani near baner'],
    ['biryani near wakad', 'pizza near wakad'],
    ['biryani near wakad', 'biryani near wakad under 300'],
    ['biryani near wakad', 'veg biryani near wakad'],
    ['biryani near wakad', 'non veg biryani near wakad'],
    ['biryani near wakad', 'biryani near wakad open now'],
    ['biryani near wakad', 'late night biryani near wakad'],
    ['biryani near wakad under 300', 'biryani near wakad under 301'],
    ['waterproofing wakad', 'terrace waterproofing wakad'],
  ])('gives different meanings different keys: %j vs %j', (a, b) => {
    expect(key(a)).not.toBe(key(b));
  });

  it('matches a fixed shape for any text', () => {
    fc.assert(
      fc.property(fc.string(), (q) => /^(food|construction)(\|[a-z0-9_-]+)*$/.test(key(q))),
      { numRuns: 300 },
    );
  });
});

describe('parseIntent: robustness', () => {
  it('always returns a valid ParsedIntent and never throws', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (q) => {
        const out = parse(q);
        return ParsedIntentSchema.safeParse(out).success;
      }),
      { numRuns: 300 },
    );
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (q) => ParsedIntentSchema.safeParse(parse(q)).success),
      { numRuns: 300 },
    );
  });

  it('gives the same answer for the same text', () => {
    fc.assert(
      fc.property(fc.string(), (q) => JSON.stringify(parse(q)) === JSON.stringify(parse(q))),
      {
        numRuns: 100,
      },
    );
  });

  it('does not depend on the order of the reference lists', () => {
    const reversed = {
      localities: [...LOCALITIES].reverse(),
      dishes: [...DISHES].reverse(),
      services: [...SERVICES].reverse(),
      serviceAliases: REFS.serviceAliases,
    };
    for (const q of [
      'biryani near wakad',
      'wakad or baner pizza',
      'terrace waterproofing cost in hinjewadi phase 2',
      'veg thali 200 ke andar kharadi',
      'paint contractor baner',
    ]) {
      expect(parseIntent(q, reversed)).toEqual(parse(q));
    }
  });

  it('does not change the reference data', () => {
    const copy = structuredClone(REFS);
    parse('terrace waterproofing cost in wakad under 5000');
    expect(REFS).toEqual(copy);
  });

  it('works without service aliases', () => {
    expect(parseIntent('roof waterproofing wakad', { ...REFS, serviceAliases: undefined })).toMatchObject({
      vertical: 'construction',
      subject_id: 'waterproofing',
      locality_id: 'wakad',
    });
  });

  it('knows no names of its own: with other reference data it finds those names, and not the fixture ones', () => {
    const refs = {
      localities: [
        makeLocality({
          id: 'example-town',
          name: 'Example Town',
          geo: { lat: 1, lng: 1 },
          aliases: ['extown'],
        }),
      ],
      dishes: DISHES.filter((d) => d.id === 'pizza'),
      services: [],
    };
    expect(parseIntent('pizza in extown', refs)).toMatchObject({
      subject_id: 'pizza',
      locality_id: 'example-town',
    });
    expect(parseIntent('biryani in wakad', refs)).toMatchObject({ subject_id: null, locality_id: null });
    expect(parseIntent('terrace waterproofing', refs)).toMatchObject({ vertical: 'food', subject_id: null });
  });

  it('finds a variant dish (the id is {variant}-{parent}) ahead of its parent', () => {
    const dishes = [
      ...DISHES,
      {
        ...DISHES.find((d) => d.id === 'biryani')!,
        id: 'chicken-biryani',
        name: 'Chicken Biryani',
        parent_id: 'biryani',
        aliases: [],
      },
    ];
    expect(parseIntent('chicken biriyani near wakad', { ...REFS, dishes })).toMatchObject({
      subject_id: 'chicken-biryani',
    });
    expect(parseIntent('biryani near wakad', { ...REFS, dishes })).toMatchObject({ subject_id: 'biryani' });
  });

  it('copes with a very long text', () => {
    const out = parse(`biryani near wakad ${'blah '.repeat(20000)}`);
    expect(ParsedIntentSchema.safeParse(out).success).toBe(true);
    expect(out).toMatchObject({ subject_id: 'biryani', locality_id: 'wakad' });
  });

  it('copes with empty reference lists', () => {
    expect(parseIntent('biryani near wakad', { localities: [], dishes: [], services: [] })).toMatchObject({
      vertical: 'food',
      subject_id: null,
      locality_id: null,
      confidence: 0,
    });
  });
});
