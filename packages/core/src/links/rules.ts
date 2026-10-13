// What each kind of page links to (plan §12). A rule lists, for one page, the pages it sits under (parents, most
// important first), whether it links the same page in the nearest localities, and its related pages (children of a
// hub first, then siblings). The engine resolves these against the manifest and applies the caps, so a rule only says
// what is wanted, never whether it exists.
import type { Host, PageType } from '../schema/index.ts';
import { NO_ADDRESS, type Address } from './address.ts';

/** One specific page. */
export interface Spec {
  kind: 'spec';
  host: Host;
  type: PageType;
  address: Address;
}

/** Every page of a type on a host whose address matches. Listed in id order by the engine. */
export interface Scan {
  kind: 'scan';
  host: Host;
  type: PageType;
  match: (candidate: Address) => boolean;
}

export interface Rule {
  parents: readonly Spec[];
  /** The page itself, in each of the nearest localities. */
  nearby: boolean;
  related: readonly (Spec | Scan)[];
}

const at = (host: Host, type: PageType, over: Partial<Address> = {}): Spec => ({
  kind: 'spec',
  host,
  type,
  address: { ...NO_ADDRESS, ...over },
});

const scan = (host: Host, type: PageType, match: (candidate: Address) => boolean): Scan => ({
  kind: 'scan',
  host,
  type,
  match,
});

/** The rule for a page, or `null` for a page that has no related links (home, places, providers, forms, legal). */
export function ruleFor(host: Host, type: PageType, a: Address): Rule | null {
  const { locality, subject, intent } = a;
  const sameLocality = (t: Address) => t.locality === locality;

  switch (`${host}:${type}`) {
    case 'main:city_hub':
    case 'food:city_hub':
    case 'construction:city_hub':
      return { parents: [at(host, 'home')], nearby: false, related: [] };

    // --- main: the locality guide links out to the two product sites ---
    case 'main:locality_guide':
      return {
        parents: [at(host, 'city_hub'), at(host, 'home')],
        nearby: true,
        related: [at('construction', 'locality_hub', { locality }), at('food', 'locality_hub', { locality })],
      };

    // --- construction ---
    case 'construction:service_cost':
      return {
        parents: [at(host, 'service_city', { subject }), at(host, 'city_hub')],
        nearby: false,
        related: [scan(host, 'service_cost', (t) => t.subject !== subject)],
      };
    case 'construction:service_city':
      return {
        parents: [at(host, 'city_hub'), at(host, 'service_cost', { subject })],
        nearby: false,
        related: [scan(host, 'service_city', (t) => t.subject !== subject)],
      };
    case 'construction:locality_hub':
      return {
        parents: [at(host, 'city_hub'), at('main', 'locality_guide', { locality })],
        nearby: true,
        related: [scan(host, 'locality_service', sameLocality)],
      };
    case 'construction:locality_service':
      return {
        parents: [
          at(host, 'locality_hub', { locality }),
          at(host, 'service_city', { subject }),
          at(host, 'service_cost', { subject }),
          at(host, 'city_hub'),
        ],
        nearby: true,
        related: [scan(host, 'locality_service', (t) => sameLocality(t) && t.subject !== subject)],
      };

    // --- food ---
    case 'food:locality_hub':
      return {
        parents: [at(host, 'city_hub'), at('main', 'locality_guide', { locality })],
        nearby: true,
        related: [
          scan(host, 'locality_food_intent', sameLocality),
          scan(host, 'dish_locality', sameLocality),
        ],
      };
    case 'food:dish_city':
      return {
        parents: [at(host, 'city_hub')],
        nearby: false,
        related: [scan(host, 'dish_city', (t) => t.subject !== subject)],
      };
    case 'food:locality_food_intent':
      return {
        parents: [at(host, 'locality_hub', { locality }), at(host, 'city_hub')],
        nearby: true,
        related: [scan(host, 'locality_food_intent', (t) => sameLocality(t) && t.intent !== intent)],
      };
    case 'food:dish_locality':
      return {
        parents: [
          at(host, 'locality_hub', { locality }),
          at(host, 'dish_city', { subject }),
          at(host, 'city_hub'),
        ],
        nearby: true,
        related: [
          scan(host, 'food_intent', (t) => sameLocality(t) && t.subject === subject),
          scan(host, 'dish_locality', (t) => sameLocality(t) && t.subject !== subject),
        ],
      };
    case 'food:food_intent':
      return {
        parents: [
          at(host, 'dish_locality', { locality, subject }),
          at(host, 'locality_hub', { locality }),
          at(host, 'dish_city', { subject }),
        ],
        nearby: true,
        related: [
          scan(host, 'food_intent', (t) => sameLocality(t) && t.subject === subject && t.intent !== intent),
        ],
      };

    default:
      return null;
  }
}
