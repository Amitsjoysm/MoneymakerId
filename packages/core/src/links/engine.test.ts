// The link engine on manifests built from the CONTRACTS §4a ids. Locality coordinates are the C01 TEST fixtures
// (rough figures, enough to order distances); nothing here is data.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ALL_SERVICE_IDS, DISH_IDS, LOCALITY_IDS } from '../constants/index.ts';
import { MESSAGE_KEYS } from '../i18n/messages.ts';
import { LOCALITIES } from '../locality/fixtures.ts';
import { haversineM } from '../locality/geo.ts';
import { LocalityFoodIntentSchema, type Host, type Locale, type PageType } from '../schema/index.ts';
import {
  LINK_CAPS,
  LINK_GROUPS,
  MAX_NEARBY_LINKS,
  MAX_PARENT_LINKS,
  MAX_RELATED_LINKS,
  type LinkGroup,
} from './caps.ts';
import { createLinkEngine, relatedLinks, type LinkEntry, type RelatedLink } from './engine.ts';

// --- manifest builders ---------------------------------------------------------------------------------------

type Status = 'index' | 'noindex' | 'skip' | 'redirect';
const STATE: Record<Status, Pick<LinkEntry, 'indexable' | 'noindex_since' | 'redirect_to'>> = {
  index: { indexable: true, noindex_since: null, redirect_to: null },
  noindex: { indexable: false, noindex_since: '2026-09-01T00:00:00.000Z', redirect_to: null },
  skip: { indexable: false, noindex_since: null, redirect_to: null },
  redirect: { indexable: false, noindex_since: null, redirect_to: '/pune/' },
};

const entry = (
  host: Host,
  page_type: PageType,
  url: string,
  status: Status = 'index',
  locale: Locale = 'en',
): LinkEntry => ({ host, locale, page_type, url, ...STATE[status] });

const INTENTS = ['veg', 'under-150', 'under-300', 'late-night'];

function construction(localities: readonly string[] = LOCALITY_IDS): LinkEntry[] {
  const out: LinkEntry[] = [];
  for (const s of ALL_SERVICE_IDS) {
    out.push(entry('construction', 'service_cost', `/pune/${s}-cost/`));
    out.push(entry('construction', 'service_city', `/pune/${s}/`));
  }
  for (const l of localities) {
    out.push(entry('construction', 'locality_hub', `/pune/${l}/`));
    for (const s of ALL_SERVICE_IDS) out.push(entry('construction', 'locality_service', `/pune/${l}/${s}/`));
  }
  return out;
}

function food(localities: readonly string[] = LOCALITY_IDS): LinkEntry[] {
  const out: LinkEntry[] = [];
  for (const d of DISH_IDS) out.push(entry('food', 'dish_city', `/pune/${d}/`));
  for (const l of localities) {
    out.push(entry('food', 'locality_hub', `/pune/${l}/`));
    for (const i of LocalityFoodIntentSchema.options) {
      out.push(entry('food', 'locality_food_intent', `/pune/${l}/${i}/`));
    }
    for (const d of DISH_IDS) {
      out.push(entry('food', 'dish_locality', `/pune/${l}/${d}/`));
      for (const i of INTENTS) out.push(entry('food', 'food_intent', `/pune/${l}/${d}/${i}/`));
    }
  }
  return out;
}

function main(localities: readonly string[] = LOCALITY_IDS): LinkEntry[] {
  return [
    entry('main', 'home', '/'),
    ...localities.map((l) => entry('main', 'locality_guide', `/pune/${l}/`)),
  ];
}

const ALL: LinkEntry[] = [...main(), ...construction(), ...food()];

const page = (host: Host, page_type: PageType, url: string, locale: Locale = 'en') => ({
  host,
  locale,
  page_type,
  url,
});

const urls = (links: readonly RelatedLink[]) => links.map((l) => l.url);
const sorted = (ids: readonly string[]) => [...ids].sort();
const geo = (id: string) => LOCALITIES.find((l) => l.id === id)!.geo;

/** The expected nearby localities, computed independently of the engine: closest first, ties by id. */
function expectedNearby(id: string, hasPage: (other: string) => boolean = () => true): string[] {
  return LOCALITIES.filter((l) => l.kind === 'locality' && l.id !== id && hasPage(l.id))
    .map((l) => ({ id: l.id, d: haversineM(geo(id), l.geo) }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
    .slice(0, MAX_NEARBY_LINKS)
    .map((x) => x.id);
}

const engine = createLinkEngine(ALL, LOCALITIES);

// --- caps ----------------------------------------------------------------------------------------------------

describe('link caps', () => {
  it('are named constants: 3 parent, 6 nearby localities, 8 related', () => {
    expect(MAX_PARENT_LINKS).toBe(3);
    expect(MAX_NEARBY_LINKS).toBe(6);
    expect(MAX_RELATED_LINKS).toBe(8);
    expect(LINK_CAPS).toEqual({ parent: 3, nearby: 6, related: 8 });
    expect(Object.isFrozen(LINK_CAPS)).toBe(true);
  });

  it('list the three groups in reading order', () => {
    expect(LINK_GROUPS).toEqual(['parent', 'nearby', 'related']);
  });

  it('each group has a heading in the English messages', () => {
    for (const group of LINK_GROUPS) expect(MESSAGE_KEYS).toContain(`links.heading.${group}`);
  });
});

// --- construction pages --------------------------------------------------------------------------------------

describe('construction: locality_service /pune/{locality}/{service}/', () => {
  const p = page('construction', 'locality_service', '/pune/wakad/terrace-waterproofing/');
  const links = engine.relatedLinks(p);

  it('links up to the locality hub, the service page and the cost guide', () => {
    expect(links.parent.map((l) => [l.host, l.page_type, l.url])).toEqual([
      ['construction', 'locality_hub', '/pune/wakad/'],
      ['construction', 'service_city', '/pune/terrace-waterproofing/'],
      ['construction', 'service_cost', '/pune/terrace-waterproofing-cost/'],
    ]);
  });

  it('links the same service in the nearest localities, closest first', () => {
    const near = expectedNearby('wakad');
    expect(near[0]).toBe('hinjewadi');
    expect(urls(links.nearby)).toEqual(near.map((n) => `/pune/${n}/terrace-waterproofing/`));
    expect(links.nearby.map((l) => l.locality_id)).toEqual(near);
    expect(
      links.nearby.every(
        (l) => l.page_type === 'locality_service' && l.subject_id === 'terrace-waterproofing',
      ),
    ).toBe(true);
  });

  it('reports each nearby distance in whole metres', () => {
    for (const l of links.nearby) {
      expect(l.distance_m).toBe(Math.round(haversineM(geo('wakad'), geo(l.locality_id!))));
    }
    const distances = links.nearby.map((l) => l.distance_m!);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('links other services in the same locality, in id order, capped at 8', () => {
    const others = sorted(ALL_SERVICE_IDS.filter((s) => s !== 'terrace-waterproofing')).slice(
      0,
      MAX_RELATED_LINKS,
    );
    expect(urls(links.related)).toEqual(others.map((s) => `/pune/wakad/${s}/`));
    expect(links.related).toHaveLength(8);
  });

  it('describes each link with the ids behind it and no distance outside the nearby group', () => {
    expect(links.parent[0]).toEqual({
      group: 'parent',
      host: 'construction',
      url: '/pune/wakad/',
      page_type: 'locality_hub',
      locality_id: 'wakad',
      subject_id: null,
      intent_id: null,
      distance_m: null,
    });
    expect(links.parent[2]).toMatchObject({ subject_id: 'terrace-waterproofing', locality_id: null });
    expect(links.related.every((l) => l.group === 'related' && l.distance_m === null)).toBe(true);
  });
});

describe('construction: locality_hub /pune/{locality}/', () => {
  const links = engine.relatedLinks(page('construction', 'locality_hub', '/pune/baner/'));

  it('links the city hub and the locality guide on the main site', () => {
    expect(links.parent.map((l) => [l.host, l.page_type, l.url])).toEqual([
      ['construction', 'city_hub', '/pune/'],
      ['main', 'locality_guide', '/pune/baner/'],
    ]);
  });

  it('links nearby locality hubs and the locality service pages', () => {
    expect(urls(links.nearby)).toEqual(expectedNearby('baner').map((n) => `/pune/${n}/`));
    expect(links.nearby.every((l) => l.host === 'construction' && l.page_type === 'locality_hub')).toBe(true);
    expect(urls(links.related)).toEqual(
      sorted(ALL_SERVICE_IDS)
        .slice(0, 8)
        .map((s) => `/pune/baner/${s}/`),
    );
    expect(links.related.every((l) => l.page_type === 'locality_service')).toBe(true);
  });
});

describe('construction: service_cost /pune/{service}-cost/', () => {
  const links = engine.relatedLinks(page('construction', 'service_cost', '/pune/painting-cost/'));

  it('links the service page and the city hub, other cost guides, and no localities', () => {
    expect(urls(links.parent)).toEqual(['/pune/painting/', '/pune/']);
    expect(urls(links.related)).toEqual(
      sorted(ALL_SERVICE_IDS.filter((s) => s !== 'painting'))
        .slice(0, 8)
        .map((s) => `/pune/${s}-cost/`),
    );
    expect(links.nearby).toEqual([]);
  });
});

describe('construction: service_city /pune/{service}/', () => {
  const links = engine.relatedLinks(page('construction', 'service_city', '/pune/modular-kitchen/'));

  it('links the city hub and its cost guide, and other services', () => {
    expect(urls(links.parent)).toEqual(['/pune/', '/pune/modular-kitchen-cost/']);
    expect(links.related.every((l) => l.page_type === 'service_city')).toBe(true);
    expect(urls(links.related)).toEqual(
      sorted(ALL_SERVICE_IDS.filter((s) => s !== 'modular-kitchen'))
        .slice(0, 8)
        .map((s) => `/pune/${s}/`),
    );
    expect(links.nearby).toEqual([]);
  });
});

// --- food pages ----------------------------------------------------------------------------------------------

describe('food: locality_hub /pune/{locality}/', () => {
  const links = engine.relatedLinks(page('food', 'locality_hub', '/pune/kharadi/'));

  it('links the city hub and the locality guide', () => {
    expect(links.parent.map((l) => [l.host, l.url])).toEqual([
      ['food', '/pune/'],
      ['main', '/pune/kharadi/'],
    ]);
  });

  it('links nearby hubs, then the locality intents before the dishes', () => {
    expect(urls(links.nearby)).toEqual(expectedNearby('kharadi').map((n) => `/pune/${n}/`));
    expect(urls(links.related)).toEqual([
      '/pune/kharadi/budget-food/',
      '/pune/kharadi/late-night-food/',
      '/pune/kharadi/veg-food/',
      ...sorted(DISH_IDS)
        .slice(0, 5)
        .map((d) => `/pune/kharadi/${d}/`),
    ]);
  });
});

describe('food: dish_city /pune/{dish}/', () => {
  const links = engine.relatedLinks(page('food', 'dish_city', '/pune/biryani/'));

  it('links the city hub and other dishes', () => {
    expect(urls(links.parent)).toEqual(['/pune/']);
    expect(urls(links.related)).toEqual(
      sorted(DISH_IDS.filter((d) => d !== 'biryani'))
        .slice(0, 8)
        .map((d) => `/pune/${d}/`),
    );
    expect(links.nearby).toEqual([]);
  });
});

describe('food: locality_food_intent /pune/{locality}/{intent}/', () => {
  const links = engine.relatedLinks(page('food', 'locality_food_intent', '/pune/wakad/late-night-food/'));

  it('links the hub and the city, the same intent nearby, and the other intents here', () => {
    expect(urls(links.parent)).toEqual(['/pune/wakad/', '/pune/']);
    expect(urls(links.nearby)).toEqual(expectedNearby('wakad').map((n) => `/pune/${n}/late-night-food/`));
    expect(urls(links.related)).toEqual(['/pune/wakad/budget-food/', '/pune/wakad/veg-food/']);
  });
});

describe('food: dish_locality /pune/{locality}/{dish}/', () => {
  const links = engine.relatedLinks(page('food', 'dish_locality', '/pune/wakad/biryani/'));

  it('links the locality hub, the dish page and the city hub', () => {
    expect(urls(links.parent)).toEqual(['/pune/wakad/', '/pune/biryani/', '/pune/']);
  });

  it('links the same dish nearby', () => {
    expect(urls(links.nearby)).toEqual(expectedNearby('wakad').map((n) => `/pune/${n}/biryani/`));
  });

  it("links the dish's intent pages first (children), then other dishes here, up to 8", () => {
    expect(urls(links.related)).toEqual([
      '/pune/wakad/biryani/late-night/',
      '/pune/wakad/biryani/under-150/',
      '/pune/wakad/biryani/under-300/',
      '/pune/wakad/biryani/veg/',
      ...sorted(DISH_IDS.filter((d) => d !== 'biryani'))
        .slice(0, 4)
        .map((d) => `/pune/wakad/${d}/`),
    ]);
  });
});

describe('food: food_intent /pune/{locality}/{dish}/{intent}/', () => {
  const links = engine.relatedLinks(page('food', 'food_intent', '/pune/wakad/biryani/under-150/'));

  it('links the dish page here, the locality hub and the dish page for the city', () => {
    expect(urls(links.parent)).toEqual(['/pune/wakad/biryani/', '/pune/wakad/', '/pune/biryani/']);
  });

  it('links the same intent nearby and the other intents of this dish here', () => {
    expect(urls(links.nearby)).toEqual(expectedNearby('wakad').map((n) => `/pune/${n}/biryani/under-150/`));
    expect(urls(links.related)).toEqual([
      '/pune/wakad/biryani/late-night/',
      '/pune/wakad/biryani/under-300/',
      '/pune/wakad/biryani/veg/',
    ]);
  });
});

// --- main site -----------------------------------------------------------------------------------------------

describe('main: locality_guide /pune/{locality}/', () => {
  const links = engine.relatedLinks(page('main', 'locality_guide', '/pune/baner/'));

  it('links the city hub and the home page', () => {
    expect(links.parent.map((l) => [l.page_type, l.url])).toEqual([
      ['city_hub', '/pune/'],
      ['home', '/'],
    ]);
  });

  it('links nearby guides, and the locality hubs on the construction and food sites', () => {
    expect(urls(links.nearby)).toEqual(expectedNearby('baner').map((n) => `/pune/${n}/`));
    expect(links.nearby.every((l) => l.host === 'main')).toBe(true);
    expect(links.related.map((l) => [l.host, l.page_type, l.url])).toEqual([
      ['construction', 'locality_hub', '/pune/baner/'],
      ['food', 'locality_hub', '/pune/baner/'],
    ]);
  });
});

describe('fixed pages and pages without links', () => {
  it('the city hub links up to the home page and nothing else', () => {
    const links = engine.relatedLinks(page('food', 'city_hub', '/pune/'));
    expect(links.parent.map((l) => [l.page_type, l.url])).toEqual([['home', '/']]);
    expect(links.nearby).toEqual([]);
    expect(links.related).toEqual([]);
  });

  it.each([
    ['main', 'home', '/'],
    ['food', 'place', '/place/example-cafe/'],
    ['construction', 'provider', '/provider/example-provider/'],
    ['construction', 'calculator', '/cost-calculator/'],
    ['construction', 'get_quotes', '/get-quotes/'],
    ['main', 'legal', '/privacy/'],
    ['food', 'not_found', '/404/'],
  ] as const)('%s %s %s has no related links', (host, type, url) => {
    expect(engine.relatedLinks(page(host, type, url))).toEqual({ parent: [], nearby: [], related: [] });
  });

  it('gives the admin host no links, and never links to an admin entry', () => {
    expect(engine.relatedLinks(page('admin', 'home', '/'))).toEqual({ parent: [], nearby: [], related: [] });
    const withAdmin = createLinkEngine([...ALL, entry('admin', 'locality_hub', '/pune/wakad/')], LOCALITIES);
    const links = withAdmin.relatedLinks(page('construction', 'locality_service', '/pune/wakad/painting/'));
    expect([...links.parent, ...links.nearby, ...links.related].some((l) => l.host === 'admin')).toBe(false);
  });

  it('a page whose url does not fit its page type has no links, and does not throw', () => {
    expect(engine.relatedLinks(page('food', 'dish_locality', '/pune/wakad/'))).toEqual({
      parent: [],
      nearby: [],
      related: [],
    });
  });
});

// --- what may be linked --------------------------------------------------------------------------------------

describe('only build_index and build_noindex pages are linked', () => {
  const wakadHub = page('construction', 'locality_hub', '/pune/wakad/');
  const near = expectedNearby('wakad');
  const nextNear = LOCALITIES.filter((l) => l.kind === 'locality' && l.id !== 'wakad')
    .map((l) => ({ id: l.id, d: haversineM(geo('wakad'), l.geo) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.id);

  /** The ALL manifest with these construction hubs changed to `status`. */
  function withHubs(ids: readonly string[], status: Status) {
    return ALL.map((e) =>
      e.host === 'construction' && e.page_type === 'locality_hub' && ids.includes(e.url.split('/')[2]!)
        ? { ...e, ...STATE[status] }
        : e,
    );
  }

  it('never links a skip page: the next nearest locality takes its place', () => {
    const links = createLinkEngine(withHubs([near[0]!], 'skip'), LOCALITIES).relatedLinks(wakadHub);
    expect(urls(links.nearby)).not.toContain(`/pune/${near[0]}/`);
    expect(links.nearby).toHaveLength(6);
    expect(links.nearby.map((l) => l.locality_id)).toEqual(nextNear.filter((n) => n !== near[0]).slice(0, 6));
  });

  it('never links a redirect_parent page', () => {
    const links = createLinkEngine(withHubs([near[1]!], 'redirect'), LOCALITIES).relatedLinks(wakadHub);
    expect(urls(links.nearby)).not.toContain(`/pune/${near[1]}/`);
    expect(links.nearby).toHaveLength(6);
  });

  it('links a build_noindex page (the grace period) in its normal place', () => {
    const links = createLinkEngine(withHubs([near[0]!], 'noindex'), LOCALITIES).relatedLinks(wakadHub);
    expect(links.nearby.map((l) => l.locality_id)).toEqual(near);
  });

  it('does not link a page the manifest has no entry for', () => {
    const manifest = ALL.filter((e) => !(e.host === 'construction' && e.url === '/pune/wakad/painting/'));
    const links = createLinkEngine(manifest, LOCALITIES).relatedLinks(
      page('construction', 'locality_service', '/pune/wakad/interior-painting/'),
    );
    expect(urls(links.related)).not.toContain('/pune/wakad/painting/');
  });

  it('fills a parent slot from the next candidate when a parent is skipped', () => {
    const manifest = ALL.map((e) =>
      e.host === 'construction' && e.url === '/pune/terrace-waterproofing/' ? { ...e, ...STATE.skip } : e,
    );
    const links = createLinkEngine(manifest, LOCALITIES).relatedLinks(
      page('construction', 'locality_service', '/pune/wakad/terrace-waterproofing/'),
    );
    expect(urls(links.parent)).toEqual(['/pune/wakad/', '/pune/terrace-waterproofing-cost/', '/pune/']);
  });

  it('never links a skipped or redirecting target of any kind', () => {
    const manifest = ALL.map((e) =>
      e.url.includes('late-night-food') || e.url.endsWith('-cost/') ? { ...e, ...STATE.redirect } : e,
    );
    const eng = createLinkEngine(manifest, LOCALITIES);
    const hub = eng.relatedLinks(page('food', 'locality_hub', '/pune/wakad/'));
    expect(urls(hub.related)).not.toContain('/pune/wakad/late-night-food/');
    expect(hub.related).toHaveLength(8);
    const cost = eng.relatedLinks(page('construction', 'service_city', '/pune/painting/'));
    expect(urls(cost.parent)).toEqual(['/pune/']);
  });
});

describe('the fixed hubs (home and the city hub) are built by every app', () => {
  const noHubs = ALL.filter((e) => e.page_type !== 'city_hub' && e.page_type !== 'home');
  const wakad = page('food', 'locality_hub', '/pune/wakad/');

  it('links /pune/ for English even though the manifest has no entry for it', () => {
    const links = createLinkEngine(noHubs, LOCALITIES).relatedLinks(wakad);
    expect(links.parent[0]).toMatchObject({ host: 'food', page_type: 'city_hub', url: '/pune/' });
  });

  it('lets a manifest entry for the hub decide: skip and redirect are not linked', () => {
    for (const status of ['skip', 'redirect'] as const) {
      const manifest = [...noHubs, entry('food', 'city_hub', '/pune/', status)];
      const links = createLinkEngine(manifest, LOCALITIES).relatedLinks(wakad);
      expect(
        links.parent.map((l) => [l.host, l.url]),
        status,
      ).toEqual([['main', '/pune/wakad/']]);
    }
  });

  it('does not assume the hub exists in Marathi or Hindi', () => {
    const mr = noHubs.map((e) => ({ ...e, locale: 'mr' as const, url: `/mr${e.url}` }));
    const links = createLinkEngine(mr, LOCALITIES).relatedLinks(
      page('food', 'locality_hub', '/mr/pune/wakad/', 'mr'),
    );
    expect(links.parent.map((l) => [l.host, l.url])).toEqual([['main', '/mr/pune/wakad/']]);
    const withHub = createLinkEngine(
      [...mr, entry('food', 'city_hub', '/mr/pune/', 'index', 'mr')],
      LOCALITIES,
    );
    expect(urls(withHub.relatedLinks(page('food', 'locality_hub', '/mr/pune/wakad/', 'mr')).parent)).toEqual([
      '/mr/pune/',
      '/mr/pune/wakad/',
    ]);
  });
});

// --- locale --------------------------------------------------------------------------------------------------

describe('locale', () => {
  const mr = [
    ...[...main(), ...construction(), ...food()].map((e) => ({
      ...e,
      locale: 'mr' as const,
      url: e.url === '/' ? '/mr/' : `/mr${e.url}`,
    })),
    ...(['main', 'food', 'construction'] as const).map((h) =>
      entry(h, 'city_hub', '/mr/pune/', 'index', 'mr'),
    ),
  ];

  it('links only pages of the same locale, using the urls the manifest gives', () => {
    const eng = createLinkEngine([...ALL, ...mr], LOCALITIES);
    const links = eng.relatedLinks(page('food', 'dish_locality', '/mr/pune/wakad/biryani/', 'mr'));
    const all = [...links.parent, ...links.nearby, ...links.related];
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((l) => l.url.startsWith('/mr/pune/'))).toBe(true);
    expect(urls(links.parent)).toEqual(['/mr/pune/wakad/', '/mr/pune/biryani/', '/mr/pune/']);
    const en = eng.relatedLinks(page('food', 'dish_locality', '/pune/wakad/biryani/'));
    expect([...en.parent, ...en.nearby, ...en.related].every((l) => !l.url.startsWith('/mr/'))).toBe(true);
  });

  it('links nothing in a locale that has no pages', () => {
    const links = engine.relatedLinks(page('food', 'dish_locality', '/hi/pune/wakad/biryani/', 'hi'));
    expect(links).toEqual({ parent: [], nearby: [], related: [] });
  });
});

// --- nearest localities --------------------------------------------------------------------------------------

describe('nearby localities', () => {
  it('are the closest by haversine distance, whatever order the localities come in', () => {
    const reversed = createLinkEngine(ALL, [...LOCALITIES].reverse());
    const p = page('construction', 'locality_hub', '/pune/hadapsar/');
    expect(reversed.relatedLinks(p).nearby.map((l) => l.locality_id)).toEqual(expectedNearby('hadapsar'));
    expect(expectedNearby('hadapsar')[0]).toBe('magarpatta');
  });

  it('skip localities that have no page and take the next closest', () => {
    const only = ['wakad', 'baner', 'aundh', 'kothrud', 'hadapsar'];
    const eng = createLinkEngine(construction(only), LOCALITIES);
    const links = eng.relatedLinks(page('construction', 'locality_hub', '/pune/wakad/'));
    expect(links.nearby.map((l) => l.locality_id)).toEqual(expectedNearby('wakad', (o) => only.includes(o)));
    expect(links.nearby).toHaveLength(4);
  });

  it('are fewer than the cap when fewer localities have pages, and empty when none do', () => {
    const eng = createLinkEngine(construction(['wakad', 'baner']), LOCALITIES);
    expect(eng.relatedLinks(page('construction', 'locality_hub', '/pune/wakad/')).nearby).toHaveLength(1);
    const alone = createLinkEngine(construction(['wakad']), LOCALITIES);
    expect(alone.relatedLinks(page('construction', 'locality_hub', '/pune/wakad/')).nearby).toEqual([]);
  });

  it('never include the page itself', () => {
    for (const id of LOCALITY_IDS) {
      const links = engine.relatedLinks(page('construction', 'locality_hub', `/pune/${id}/`));
      expect(links.nearby.map((l) => l.locality_id)).not.toContain(id);
    }
  });

  it('are localities only: no sub-locality or landmark, even when it has a page', () => {
    const manifest = [
      ...construction(),
      ...['hinjewadi-phase-1', 'hinjewadi-phase-2', 'near-example-chowk'].map((id) =>
        entry('construction', 'locality_hub', `/pune/${id}/`),
      ),
    ];
    const eng = createLinkEngine(manifest, LOCALITIES);
    for (const from of ['hinjewadi', 'hinjewadi-phase-1', 'near-example-chowk']) {
      const links = eng.relatedLinks(page('construction', 'locality_hub', `/pune/${from}/`));
      const kinds = links.nearby.map((l) => LOCALITIES.find((x) => x.id === l.locality_id)!.kind);
      expect(new Set(kinds)).toEqual(new Set(['locality']));
      expect(links.nearby).toHaveLength(6);
    }
  });

  it('are empty, and nothing else breaks, when the locality is not in the locality data', () => {
    const eng = createLinkEngine(
      ALL,
      LOCALITIES.filter((l) => l.id !== 'wakad'),
    );
    const links = eng.relatedLinks(page('construction', 'locality_service', '/pune/wakad/painting/'));
    expect(links.nearby).toEqual([]);
    expect(urls(links.parent)).toEqual(['/pune/wakad/', '/pune/painting/', '/pune/painting-cost/']);
    expect(links.related.length).toBeGreaterThan(0);
  });
});

// --- ordering ------------------------------------------------------------------------------------------------

describe('ordering', () => {
  it('puts numbers in numeric order: under-150, under-300, under-1000', () => {
    const manifest = [
      entry('food', 'food_intent', '/pune/wakad/biryani/under-1000/'),
      entry('food', 'food_intent', '/pune/wakad/biryani/under-150/'),
      entry('food', 'food_intent', '/pune/wakad/biryani/under-300/'),
      entry('food', 'food_intent', '/pune/wakad/biryani/family/'),
      entry('food', 'dish_locality', '/pune/wakad/biryani/'),
    ];
    const links = createLinkEngine(manifest, LOCALITIES).relatedLinks(
      page('food', 'dish_locality', '/pune/wakad/biryani/'),
    );
    expect(urls(links.related)).toEqual([
      '/pune/wakad/biryani/family/',
      '/pune/wakad/biryani/under-150/',
      '/pune/wakad/biryani/under-300/',
      '/pune/wakad/biryani/under-1000/',
    ]);
  });

  it('does not depend on the order of the manifest or the localities', () => {
    const pages = [
      page('construction', 'locality_service', '/pune/wakad/terrace-waterproofing/'),
      page('food', 'dish_locality', '/pune/kharadi/dosa/'),
      page('main', 'locality_guide', '/pune/baner/'),
      page('food', 'locality_hub', '/pune/hadapsar/'),
    ];
    const sample = [
      ...main(),
      ...construction(['wakad', 'baner', 'hadapsar', 'kharadi']),
      ...food(['kharadi', 'wakad', 'baner', 'hadapsar']),
    ];
    const base = createLinkEngine(sample, LOCALITIES);
    fc.assert(
      fc.property(
        fc.shuffledSubarray(sample, { minLength: sample.length, maxLength: sample.length }),
        fc.shuffledSubarray(LOCALITIES, { minLength: LOCALITIES.length, maxLength: LOCALITIES.length }),
        (m, l) => {
          const shuffled = createLinkEngine(m, l);
          for (const p of pages) expect(shuffled.relatedLinks(p)).toEqual(base.relatedLinks(p));
        },
      ),
      { numRuns: 25 },
    );
  });
});

// --- invariants over every page ------------------------------------------------------------------------------

/** A deterministic status per entry, from a seed: a quarter each of index, noindex, skip and redirect. */
function statuses(seed: number): LinkEntry[] {
  let x = seed >>> 0 || 1;
  return ALL.map((e) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const status = (['index', 'noindex', 'skip', 'redirect'] as const)[x >>> 30];
    return { ...e, ...STATE[status!] };
  });
}

/** Every way a page's links break the rules, as readable lines (empty when they hold). Plain checks, not `expect`, so
 * that thousands of pages stay fast. */
function violations(manifest: readonly LinkEntry[], eng: ReturnType<typeof createLinkEngine>): string[] {
  const bad: string[] = [];
  const byKey = new Map(manifest.map((e) => [`${e.host} ${e.locale} ${e.url}`, e]));
  for (const e of manifest) {
    const links = eng.relatedLinks(e);
    const label = `${e.host} ${e.url}`;
    if (links.parent.length > MAX_PARENT_LINKS) bad.push(`${label}: ${links.parent.length} parent links`);
    if (links.nearby.length > MAX_NEARBY_LINKS) bad.push(`${label}: ${links.nearby.length} nearby links`);
    if (links.related.length > MAX_RELATED_LINKS) bad.push(`${label}: ${links.related.length} related links`);
    const seen = new Set<string>([`${e.host} ${e.url}`]);
    for (const group of LINK_GROUPS) {
      for (const l of links[group as LinkGroup]) {
        const key = `${l.host} ${l.url}`;
        if (l.group !== group) bad.push(`${label} -> ${key}: filed under ${group} but says ${l.group}`);
        if (seen.has(key)) bad.push(`${label} -> ${key}: repeated, or links to itself`);
        seen.add(key);
        if (l.host === 'admin') bad.push(`${label} -> ${key}: admin host`);
        const target = byKey.get(`${l.host} ${e.locale} ${l.url}`);
        if (target) {
          if (!target.indexable && target.noindex_since === null) bad.push(`${label} -> ${key}: skip page`);
          if (!target.indexable && target.redirect_to !== null)
            bad.push(`${label} -> ${key}: redirecting page`);
          if (l.page_type !== target.page_type)
            bad.push(`${label} -> ${key}: wrong page type ${l.page_type}`);
        } else if (l.page_type !== 'home' && l.page_type !== 'city_hub') {
          bad.push(`${label} -> ${key}: not in the manifest and not a fixed hub`);
        }
      }
    }
  }
  return bad;
}

describe('invariants', () => {
  it('hold for every page of a full manifest: caps, no repeats, no self-link, only linkable targets', () => {
    expect(violations(ALL, engine)).toEqual([]);
  });

  it('are checked sharply: an engine that thinks every page is built does link to skipped pages', () => {
    expect(violations(statuses(7), engine).some((line) => /skip page|redirecting page/.test(line))).toBe(
      true,
    );
  });

  it('hold when a random quarter of the pages are skipped, redirected or noindex', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (seed) => {
        const manifest = statuses(seed);
        expect(violations(manifest, createLinkEngine(manifest, LOCALITIES))).toEqual([]);
      }),
      { numRuns: 4 },
    );
  });
});

// --- API -----------------------------------------------------------------------------------------------------

describe('relatedLinks()', () => {
  it('gives the same answer as an engine built from the same inputs', () => {
    const p = page('food', 'dish_locality', '/pune/aundh/dosa/');
    expect(relatedLinks(p, ALL, LOCALITIES)).toEqual(engine.relatedLinks(p));
  });

  it('accepts a full manifest entry as the page', () => {
    const e = ALL.find((x) => x.host === 'food' && x.url === '/pune/aundh/dosa/')!;
    expect(engine.relatedLinks(e)).toEqual(
      engine.relatedLinks(page('food', 'dish_locality', '/pune/aundh/dosa/')),
    );
  });

  it('does not change its inputs, and returns fresh objects', () => {
    const manifest = ALL.map((e) => Object.freeze({ ...e }));
    Object.freeze(manifest);
    const localities = Object.freeze([...LOCALITIES]);
    const links = relatedLinks(page('food', 'dish_locality', '/pune/aundh/dosa/'), manifest, localities);
    expect(links.related.length).toBeGreaterThan(0);
    for (const group of LINK_GROUPS) {
      for (const l of links[group]) expect(manifest.includes(l as unknown as LinkEntry)).toBe(false);
    }
  });

  it('throws when two entries address the same page', () => {
    const twice = [
      entry('food', 'locality_hub', '/pune/wakad/'),
      entry('food', 'locality_hub', '/pune/wakad/', 'skip'),
    ];
    expect(() => createLinkEngine(twice, LOCALITIES)).toThrow(/duplicate manifest entry/);
  });

  it('throws for a manifest url that is not a path', () => {
    expect(() =>
      createLinkEngine(
        [entry('food', 'locality_hub', 'https://food.marketmindai.com/pune/wakad/')],
        LOCALITIES,
      ),
    ).toThrow(RangeError);
  });
});
