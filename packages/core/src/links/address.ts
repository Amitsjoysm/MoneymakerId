// What a page IS, read from its URL (CONTRACTS §11). A manifest entry carries a URL and a page type but not the ids
// behind them, so the link engine reads the locality, the service or dish, and the intent out of the path, and builds
// paths back from the same three ids. Pure string work; the locale prefix (`/mr`, `/hi`) is ignored.
import type { Host, PageType } from '../schema/index.ts';
import { PREFIXED_LOCALES } from '../i18n/locale.ts';

/** The ids a page is about. `subject` is the service (construction) or the dish (food). */
export interface Address {
  locality: string | null;
  subject: string | null;
  intent: string | null;
}

export const NO_ADDRESS: Address = Object.freeze({ locality: null, subject: null, intent: null });

type Field = keyof Address;

interface Shape {
  /** Fixed leading segments: `pune` for everything under the city, none for the home page. */
  head: readonly string[];
  /** The id segments that follow, in order. */
  fields: readonly Field[];
  /** `service_cost` pages spell the service as `{service}-cost`. */
  costSuffix?: boolean;
}

const HOME: Shape = { head: [], fields: [] };
const CITY: Shape = { head: ['pune'], fields: [] };
const under = (...fields: Field[]): Shape => ({ head: ['pune'], fields });

const PER_HOST: Record<Host, Partial<Record<PageType, Shape>>> = {
  main: { home: HOME, city_hub: CITY, locality_guide: under('locality') },
  food: {
    home: HOME,
    city_hub: CITY,
    locality_hub: under('locality'),
    dish_city: under('subject'),
    locality_food_intent: under('locality', 'intent'),
    dish_locality: under('locality', 'subject'),
    food_intent: under('locality', 'subject', 'intent'),
  },
  construction: {
    home: HOME,
    city_hub: CITY,
    service_cost: { ...under('subject'), costSuffix: true },
    service_city: under('subject'),
    locality_hub: under('locality'),
    locality_service: under('locality', 'subject'),
  },
  admin: {},
};

const COST_SUFFIX = '-cost';
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The path segments of a manifest url: no locale prefix, query string, fragment or empty segment.
 * Throws `RangeError` for anything that is not a host-relative path (manifest urls always are).
 */
export function segmentsOf(url: string): string[] {
  if (!url.startsWith('/'))
    throw new RangeError(`manifest url must be a path starting with "/", got "${url}"`);
  const cut = url.search(/[?#]/);
  const segments = (cut === -1 ? url : url.slice(0, cut)).split('/').filter((s) => s !== '');
  if (segments.length > 0 && (PREFIXED_LOCALES as readonly string[]).includes(segments[0]!)) segments.shift();
  return segments;
}

/** The address of a page of this host and type at these segments, or `null` when the shape does not fit. */
export function parseAddress(host: Host, pageType: PageType, segments: readonly string[]): Address | null {
  const shape = PER_HOST[host][pageType];
  if (!shape || segments.length !== shape.head.length + shape.fields.length) return null;
  if (!shape.head.every((h, i) => segments[i] === h)) return null;
  const address: Address = { ...NO_ADDRESS };
  for (const [i, field] of shape.fields.entries()) {
    let id = segments[shape.head.length + i]!;
    if (shape.costSuffix) {
      if (!id.endsWith(COST_SUFFIX)) return null;
      id = id.slice(0, -COST_SUFFIX.length);
    }
    if (!SLUG.test(id)) return null;
    address[field] = id;
  }
  return address;
}

/** The segments of the page at this address, or `null` when the page type has no such URL or an id is missing. */
export function buildSegments(host: Host, pageType: PageType, address: Address): string[] | null {
  const shape = PER_HOST[host][pageType];
  if (!shape) return null;
  const out = [...shape.head];
  for (const field of shape.fields) {
    const id = address[field];
    if (id === null) return null;
    out.push(shape.costSuffix ? id + COST_SUFFIX : id);
  }
  return out;
}
