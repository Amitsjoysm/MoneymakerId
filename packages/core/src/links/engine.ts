// The internal link engine (plan §12; CONTRACTS §6, §11). Given the page being rendered, the build manifest and the
// locality data, it says which other pages this page should link to, in three capped groups: the pages it sits under
// (parent), the same page in the nearest localities (nearby), and sibling or child pages (related).
//
// - Only pages the app renders are linked: a manifest action of `build_index` or `build_noindex`. A `skip` or
//   `redirect_parent` URL is never linked, and neither is a page the manifest has no entry for. The two fixed pages
//   every app builds without the gate (the home page `/` and the city hub `/pune/`) are linked in English when the
//   manifest says nothing about them; Marathi and Hindi pages exist only where the manifest lists them.
// - Links stay inside the page's own locale; hosts may differ (a locality guide links to the product sites).
// - The engine is pure and deterministic: nothing is read from the environment, the same inputs give the same links
//   whatever order they arrive in, and the inputs are never changed.
import { DEFAULT_LOCALE } from '../i18n/locale.ts';
import { manifestAction } from '../gate/manifest.ts';
import { nearest, type NearestResult } from '../locality/geo.ts';
import type { Host, Locale, Locality, ManifestEntry, PageType } from '../schema/index.ts';
import { buildSegments, NO_ADDRESS, parseAddress, segmentsOf, type Address } from './address.ts';
import { LINK_CAPS, type LinkGroup } from './caps.ts';
import { ruleFor, type Spec } from './rules.ts';

/** The part of a manifest entry the engine reads. A full `ManifestEntry` fits. */
export type LinkEntry = Pick<
  ManifestEntry,
  'url' | 'host' | 'locale' | 'page_type' | 'indexable' | 'noindex_since' | 'redirect_to'
>;

/** The page being rendered. A manifest entry fits. */
export type LinkPage = Pick<ManifestEntry, 'url' | 'host' | 'locale' | 'page_type'>;

export interface RelatedLink {
  group: LinkGroup;
  host: Host;
  /** As the manifest gives it (host-relative, with the locale prefix for Marathi and Hindi). */
  url: string;
  page_type: PageType;
  /** The ids the target page is about, so the caller can look up names: the locality, the service or dish, the intent. */
  locality_id: string | null;
  subject_id: string | null;
  intent_id: string | null;
  /** Whole metres from the current page's locality; only on `nearby` links. */
  distance_m: number | null;
}

export type RelatedLinks = Record<LinkGroup, RelatedLink[]>;

export interface LinkEngine {
  relatedLinks(page: LinkPage): RelatedLinks;
}

interface Target {
  id: string;
  host: Host;
  type: PageType;
  url: string;
  address: Address;
}

const FIXED_TYPES: ReadonlySet<PageType> = new Set<PageType>(['home', 'city_hub']);

const idOf = (host: Host, locale: Locale, segments: readonly string[]): string =>
  `${host} ${locale} ${segments.join('/')}`;

const emptyLinks = (): RelatedLinks => ({ parent: [], nearby: [], related: [] });

// --- ordering ------------------------------------------------------------------------------------------------

const CHUNK = /\d+|\D+/g;
const isDigits = (s: string) => s.charCodeAt(0) >= 48 && s.charCodeAt(0) <= 57;

/** Code-unit order, except that runs of digits compare as numbers: `under-150` < `under-300` < `under-1000`. */
function compareNatural(a: string, b: string): number {
  const x = a.match(CHUNK) ?? [];
  const y = b.match(CHUNK) ?? [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const p = x[i]!;
    const q = y[i]!;
    if (isDigits(p) && isDigits(q)) {
      const d = Number(p) - Number(q);
      if (d !== 0) return d < 0 ? -1 : 1;
    } else if (p !== q) {
      return p < q ? -1 : 1;
    }
  }
  return x.length - y.length || (a < b ? -1 : a > b ? 1 : 0);
}

function compareTargets(a: Target, b: Target): number {
  for (const field of ['locality', 'subject', 'intent'] as const) {
    const c = compareNatural(a.address[field] ?? '', b.address[field] ?? '');
    if (c !== 0) return c;
  }
  return compareNatural(a.url, b.url);
}

// --- the engine ----------------------------------------------------------------------------------------------

/**
 * Indexes the manifest once; reuse the engine for every page of a build. Throws `RangeError` when a manifest url is
 * not a path, or when two entries address the same page (the gate never produces either).
 */
export function createLinkEngine(
  manifest: readonly LinkEntry[],
  localities: readonly Locality[],
): LinkEngine {
  /** Pages that may be linked, by id. */
  const linkable = new Map<string, Target>();
  /** Pages the manifest lists but the app does not render (skip, redirect_parent). */
  const blocked = new Set<string>();
  /** Linkable pages by host, locale and page type, in id order. */
  const byType = new Map<string, Target[]>();
  const typeKey = (host: Host, locale: Locale, type: PageType) => `${host} ${locale} ${type}`;

  for (const entry of manifest) {
    const segments = segmentsOf(entry.url);
    if (entry.host === 'admin') continue;
    const address = parseAddress(entry.host, entry.page_type, segments);
    if (!address) continue; // not a page the engine links (a place, a provider, a form, ...)
    const id = idOf(entry.host, entry.locale, segments);
    if (linkable.has(id) || blocked.has(id)) throw new RangeError(`duplicate manifest entry for ${id}`);
    const action = manifestAction(entry);
    if (action !== 'build_index' && action !== 'build_noindex') {
      blocked.add(id);
      continue;
    }
    const target: Target = { id, host: entry.host, type: entry.page_type, url: entry.url, address };
    linkable.set(id, target);
    const key = typeKey(entry.host, entry.locale, entry.page_type);
    const list = byType.get(key);
    if (list) list.push(target);
    else byType.set(key, [target]);
  }
  for (const list of byType.values()) list.sort(compareTargets);

  const geoOf = new Map(localities.map((l) => [l.id, l.geo]));
  const neighbourCache = new Map<string, NearestResult[]>();
  /** Every locality, closest first, ties by id; the locality itself is left out. */
  function neighbours(localityId: string): readonly NearestResult[] {
    let found = neighbourCache.get(localityId);
    if (!found) {
      const geo = geoOf.get(localityId);
      found = geo
        ? nearest(geo, localities, localities.length).filter((r) => r.locality_id !== localityId)
        : [];
      neighbourCache.set(localityId, found);
    }
    return found;
  }

  /** The page at `address`, if it may be linked. */
  function resolve(host: Host, locale: Locale, type: PageType, address: Address): Target | null {
    const segments = buildSegments(host, type, address);
    if (!segments) return null;
    const id = idOf(host, locale, segments);
    const hit = linkable.get(id);
    if (hit) return hit;
    if (blocked.has(id)) return null;
    if (FIXED_TYPES.has(type) && locale === DEFAULT_LOCALE) {
      return {
        id,
        host,
        type,
        url: segments.length === 0 ? '/' : `/${segments.join('/')}/`,
        address: NO_ADDRESS,
      };
    }
    return null;
  }

  function relatedLinks(page: LinkPage): RelatedLinks {
    const { host, locale, page_type: type } = page;
    const segments = segmentsOf(page.url);
    const address = parseAddress(host, type, segments);
    const rule = address && ruleFor(host, type, address);
    if (!address || !rule) return emptyLinks();

    const out = emptyLinks();
    const seen = new Set<string>([idOf(host, locale, segments)]);

    /** Adds the page to the group unless it is the current page, already linked, or the group is full. */
    function add(group: LinkGroup, target: Target | null, distance: number | null = null): boolean {
      if (out[group].length >= LINK_CAPS[group]) return false;
      if (!target || seen.has(target.id)) return true;
      seen.add(target.id);
      out[group].push({
        group,
        host: target.host,
        url: target.url,
        page_type: target.type,
        locality_id: target.address.locality,
        subject_id: target.address.subject,
        intent_id: target.address.intent,
        distance_m: distance,
      });
      return out[group].length < LINK_CAPS[group];
    }

    const specTarget = (s: Spec) => resolve(s.host, locale, s.type, s.address);

    for (const spec of rule.parents) if (!add('parent', specTarget(spec))) break;

    if (rule.nearby && address.locality !== null) {
      for (const near of neighbours(address.locality)) {
        const target = resolve(host, locale, type, { ...address, locality: near.locality_id });
        if (!add('nearby', target, near.distance_m)) break;
      }
    }

    related: for (const source of rule.related) {
      if (source.kind === 'spec') {
        if (!add('related', specTarget(source))) break;
      } else {
        for (const target of byType.get(typeKey(source.host, locale, source.type)) ?? []) {
          if (source.match(target.address) && !add('related', target)) break related;
        }
      }
    }
    return out;
  }

  return { relatedLinks };
}

/** One-off form of the engine. Indexing is O(manifest) per call: build one engine per build when rendering many pages. */
export function relatedLinks(
  page: LinkPage,
  manifest: readonly LinkEntry[],
  localities: readonly Locality[],
): RelatedLinks {
  return createLinkEngine(manifest, localities).relatedLinks(page);
}
