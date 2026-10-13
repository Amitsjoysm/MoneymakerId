import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildSegments, parseAddress, segmentsOf, type Address } from './address.ts';

const addr = (over: Partial<Address> = {}): Address => ({
  locality: null,
  subject: null,
  intent: null,
  ...over,
});
const parse = (
  host: Parameters<typeof parseAddress>[0],
  type: Parameters<typeof parseAddress>[1],
  url: string,
) => parseAddress(host, type, segmentsOf(url));

describe('segmentsOf', () => {
  it('splits a path into its segments, ignoring slashes at the ends', () => {
    expect(segmentsOf('/')).toEqual([]);
    expect(segmentsOf('/pune/')).toEqual(['pune']);
    expect(segmentsOf('/pune/wakad/waterproofing/')).toEqual(['pune', 'wakad', 'waterproofing']);
    expect(segmentsOf('/pune/wakad')).toEqual(['pune', 'wakad']);
  });

  it('drops the locale prefix, the query string and the fragment', () => {
    expect(segmentsOf('/mr/pune/wakad/')).toEqual(['pune', 'wakad']);
    expect(segmentsOf('/hi/')).toEqual([]);
    expect(segmentsOf('/pune/wakad/?a=1#b')).toEqual(['pune', 'wakad']);
  });

  it('rejects anything that is not a path', () => {
    expect(() => segmentsOf('https://food.marketmindai.com/pune/')).toThrow(RangeError);
    expect(() => segmentsOf('pune/')).toThrow(RangeError);
  });
});

describe('parseAddress: the URL shapes of CONTRACTS §11', () => {
  it('reads the fixed pages of every public host', () => {
    for (const host of ['main', 'food', 'construction'] as const) {
      expect(parse(host, 'home', '/')).toEqual(addr());
      expect(parse(host, 'city_hub', '/pune/')).toEqual(addr());
    }
  });

  it('reads construction pages', () => {
    expect(parse('construction', 'service_cost', '/pune/terrace-waterproofing-cost/')).toEqual(
      addr({ subject: 'terrace-waterproofing' }),
    );
    expect(parse('construction', 'service_city', '/pune/painting/')).toEqual(addr({ subject: 'painting' }));
    expect(parse('construction', 'locality_hub', '/pune/hinjewadi/')).toEqual(
      addr({ locality: 'hinjewadi' }),
    );
    expect(parse('construction', 'locality_service', '/pune/hinjewadi/painting/')).toEqual(
      addr({ locality: 'hinjewadi', subject: 'painting' }),
    );
  });

  it('reads food pages', () => {
    expect(parse('food', 'locality_hub', '/pune/wakad/')).toEqual(addr({ locality: 'wakad' }));
    expect(parse('food', 'dish_city', '/pune/biryani/')).toEqual(addr({ subject: 'biryani' }));
    expect(parse('food', 'locality_food_intent', '/pune/wakad/late-night-food/')).toEqual(
      addr({ locality: 'wakad', intent: 'late-night-food' }),
    );
    expect(parse('food', 'dish_locality', '/pune/wakad/biryani/')).toEqual(
      addr({ locality: 'wakad', subject: 'biryani' }),
    );
    expect(parse('food', 'food_intent', '/pune/wakad/biryani/under-150/')).toEqual(
      addr({ locality: 'wakad', subject: 'biryani', intent: 'under-150' }),
    );
  });

  it('reads the main-site locality guide', () => {
    expect(parse('main', 'locality_guide', '/pune/baner/')).toEqual(addr({ locality: 'baner' }));
  });

  it('reads Marathi and Hindi urls like English ones', () => {
    expect(parse('food', 'dish_locality', '/mr/pune/wakad/biryani/')).toEqual(
      addr({ locality: 'wakad', subject: 'biryani' }),
    );
  });

  it('returns null when the url does not have the shape of its page type', () => {
    expect(parse('construction', 'service_cost', '/pune/painting/')).toBeNull(); // no -cost suffix
    expect(parse('construction', 'service_cost', '/pune/-cost/')).toBeNull(); // nothing before the suffix
    expect(parse('construction', 'locality_service', '/pune/hinjewadi/')).toBeNull(); // too short
    expect(parse('food', 'dish_locality', '/pune/wakad/biryani/extra/')).toBeNull(); // too long
    expect(parse('food', 'locality_hub', '/city/wakad/')).toBeNull(); // wrong head
    expect(parse('food', 'locality_hub', '/pune/Wakad/')).toBeNull(); // not a slug
    expect(parse('food', 'locality_hub', '/pune/wa kad/')).toBeNull();
    expect(parse('food', 'home', '/pune/')).toBeNull();
  });

  it('returns null for page types and hosts it does not address', () => {
    expect(parse('food', 'place', '/place/example-cafe/')).toBeNull();
    expect(parse('construction', 'provider', '/provider/example/')).toBeNull();
    expect(parse('construction', 'calculator', '/cost-calculator/')).toBeNull();
    expect(parse('construction', 'dish_city', '/pune/biryani/')).toBeNull(); // a food page type on the wrong host
    expect(parse('food', 'service_city', '/pune/painting/')).toBeNull();
    expect(parse('construction', 'locality_guide', '/pune/baner/')).toBeNull(); // guides live on main
    expect(parse('admin', 'home', '/')).toBeNull();
    expect(parse('admin', 'city_hub', '/pune/')).toBeNull();
  });
});

describe('buildSegments: the inverse of parseAddress', () => {
  it('builds each shape', () => {
    expect(buildSegments('food', 'home', addr())).toEqual([]);
    expect(buildSegments('construction', 'city_hub', addr())).toEqual(['pune']);
    expect(buildSegments('construction', 'service_cost', addr({ subject: 'painting' }))).toEqual([
      'pune',
      'painting-cost',
    ]);
    expect(
      buildSegments('food', 'food_intent', addr({ locality: 'wakad', subject: 'biryani', intent: 'veg' })),
    ).toEqual(['pune', 'wakad', 'biryani', 'veg']);
  });

  it('returns null when a field the shape needs is missing, or the page type is not addressable', () => {
    expect(buildSegments('food', 'dish_locality', addr({ locality: 'wakad' }))).toBeNull();
    expect(buildSegments('food', 'locality_hub', addr())).toBeNull();
    expect(buildSegments('food', 'place', addr())).toBeNull();
    expect(buildSegments('admin', 'home', addr())).toBeNull();
  });

  it('ignores fields the shape does not use', () => {
    expect(buildSegments('food', 'locality_hub', addr({ locality: 'wakad', subject: 'biryani' }))).toEqual([
      'pune',
      'wakad',
    ]);
  });

  it('property: parse(build(a)) is a, for every addressable shape', () => {
    const slug = fc
      .stringMatching(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .filter((s) => s !== 'cost' && !s.endsWith('-cost'));
    const shapes = [
      ['construction', 'service_cost', ['subject']],
      ['construction', 'service_city', ['subject']],
      ['construction', 'locality_hub', ['locality']],
      ['construction', 'locality_service', ['locality', 'subject']],
      ['food', 'locality_hub', ['locality']],
      ['food', 'dish_city', ['subject']],
      ['food', 'locality_food_intent', ['locality', 'intent']],
      ['food', 'dish_locality', ['locality', 'subject']],
      ['food', 'food_intent', ['locality', 'subject', 'intent']],
      ['main', 'locality_guide', ['locality']],
    ] as const;
    fc.assert(
      fc.property(fc.constantFrom(...shapes), slug, slug, slug, ([host, type, fields], a, b, c) => {
        const pool = { locality: a, subject: b, intent: c };
        const address = addr();
        for (const f of fields) address[f] = pool[f];
        const segments = buildSegments(host, type, address);
        expect(segments).not.toBeNull();
        expect(parseAddress(host, type, segments!)).toEqual(address);
      }),
    );
  });
});
