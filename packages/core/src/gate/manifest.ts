// The build manifest (CONTRACTS §6, §8): every candidate page of every host, its gate decision, and the hash of its
// data inputs. Produced before `astro build`; the apps render only the pages whose action is build_index or
// build_noindex, and the sitemaps list only the indexable ones with `lastmod = hash_changed_at`.
import type {
  CatalogueSnapshot,
  GateAction,
  GateConfig,
  GateKey,
  ManifestEntry,
  PageCandidate,
} from '../schema/index.ts';
import { enumerateCandidates } from './candidates.ts';
import { compareText } from './catalogue.ts';
import { contentHash } from './hash.ts';
import { proseReviewed } from './prose.ts';
import { assessCandidate, decide, gateKeyOf, type Assessment } from './rules.ts';
import { shinglesOf } from './shingles.ts';

const CITY_URL = '/pune/';

/** Page types that are only indexed while their parent page is (plan §5: an intent page needs its parent page to pass). */
const NEEDS_INDEXED_PARENT: ReadonlySet<GateKey> = new Set<GateKey>([
  'food:food_intent',
  'food:locality_food_intent',
]);

/** The most ancestors a redirect climbs through before giving up. */
const MAX_CLIMB = 8;

const GONE = 'the page is no longer a candidate: its data is gone';

type PageId = Pick<ManifestEntry, 'host' | 'locale' | 'url'>;
const idOf = (p: PageId): string => `${p.host} ${p.locale} ${p.url}`;

/**
 * What an app does with a manifest entry. The entry has no action field; it is read from the state:
 * indexable is build_index; redirecting is redirect_parent; in the noindex grace period is build_noindex; anything
 * else (never published) is skip and must not be rendered.
 */
export function manifestAction(
  entry: Pick<ManifestEntry, 'indexable' | 'noindex_since' | 'redirect_to'>,
): GateAction {
  if (entry.indexable) return 'build_index';
  if (entry.redirect_to !== null) return 'redirect_parent';
  return entry.noindex_since !== null ? 'build_noindex' : 'skip';
}

function parentFailed(a: Assessment, parentUrl: string): Assessment {
  const reasons = [...a.result.reasons, `parent page ${parentUrl} is not indexed`];
  return { result: { ...a.result, passed: false, reasons }, stay: false };
}

/** The closest ancestor URL that is a built page of this manifest, else the city page; null for the city page itself. */
function nearestParent(page: PageId, known: ReadonlySet<string>): string | null {
  const segments = page.url.split('/').filter(Boolean);
  for (let n = segments.length - 1; n >= 1; n--) {
    const url = `/${segments.slice(0, n).join('/')}/`;
    if (url === CITY_URL || known.has(idOf({ ...page, url }))) return url;
  }
  return null;
}

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * For each page, the pages of its own GateKey that can have a non-zero similarity to it: those that share at least one
 * shingle (two pages without any shared shingle have Jaccard 0, so leaving them out changes no uniqueness score). Two
 * pages with no text at all are identical, so they are each other's neighbours. This keeps the check near-linear on a
 * catalogue of thousands of pages instead of comparing every pair.
 */
function neighbours(candidates: readonly PageCandidate[]): Map<PageCandidate, PageCandidate[]> {
  const postings = new Map<string, PageCandidate[]>();
  const empty = new Map<GateKey, PageCandidate[]>();
  for (const c of candidates) {
    const key = gateKeyOf(c);
    const shingles = shinglesOf(c);
    if (shingles.size === 0) append(empty, key, c);
    for (const shingle of shingles) {
      append(postings, `${key}\u0000${shingle}`, c);
    }
  }
  const out = new Map<PageCandidate, PageCandidate[]>();
  for (const c of candidates) {
    const key = gateKeyOf(c);
    const shingles = shinglesOf(c);
    const near = new Set<PageCandidate>(shingles.size === 0 ? empty.get(key) : []);
    for (const shingle of shingles)
      for (const other of postings.get(`${key}\u0000${shingle}`) ?? []) near.add(other);
    near.delete(c);
    out.set(c, [...near]);
  }
  return out;
}

/**
 * Enumerates the candidates, runs the gate on each (with `snapshot.previous_manifest` as the history), and hashes each
 * page's data inputs. `hash_changed_at` carries over from the previous entry while the hash is unchanged.
 *
 * A page that was published (indexed, or in its noindex grace period) and is no longer a candidate at all goes
 * through the same hysteresis path with zero scores, so it also ends in a 301 to its nearest parent instead of a 404.
 * Async because the hash uses Web Crypto; it runs unchanged in Node and Workers.
 */
export async function buildManifest(
  snapshot: CatalogueSnapshot,
  cfg: GateConfig,
  now: Date,
): Promise<ManifestEntry[]> {
  const candidates = enumerateCandidates(snapshot, now);
  const reviewed = proseReviewed(snapshot);
  const stamp = now.toISOString();
  const previous = new Map(snapshot.previous_manifest.map((e) => [idOf(e), e]));
  const hashes = await Promise.all(candidates.map((c) => contentHash(c.data_inputs)));

  const siblingsOf = neighbours(candidates);

  const entries = new Map<string, ManifestEntry>();
  const evaluate = (c: PageCandidate, hash: string): void => {
    const key = gateKeyOf(c);
    const prev = previous.get(idOf(c)) ?? null;
    let assessment = assessCandidate(c, siblingsOf.get(c) ?? [], cfg, reviewed);
    if (NEEDS_INDEXED_PARENT.has(key) && c.parent_url !== null) {
      const parent = entries.get(idOf({ host: c.host, locale: c.locale, url: c.parent_url }));
      if (parent === undefined || !parent.indexable) assessment = parentFailed(assessment, c.parent_url);
    }
    const decision = decide(assessment, c, prev, cfg, now);
    entries.set(idOf(c), {
      url: c.url,
      host: c.host,
      locale: c.locale,
      page_type: c.page_type,
      indexable: decision.action === 'build_index',
      content_hash: hash,
      hash_changed_at: prev !== null && prev.content_hash === hash ? prev.hash_changed_at : stamp,
      gate: decision.result,
      noindex_since: decision.noindex_since,
      redirect_to: decision.action === 'redirect_parent' ? c.parent_url : null,
    });
  };
  // Parents first: a page that needs its parent to be indexed is decided after the parent is.
  candidates.forEach((c, i) => {
    if (!NEEDS_INDEXED_PARENT.has(gateKeyOf(c))) evaluate(c, hashes[i]!);
  });
  candidates.forEach((c, i) => {
    if (NEEDS_INDEXED_PARENT.has(gateKeyOf(c))) evaluate(c, hashes[i]!);
  });

  // A 301 must land on a page that exists. The parent hub may itself be skipped or redirecting, so a redirect lands on
  // the nearest ancestor that is built (indexed or noindex), or on a page this manifest does not manage (the city page).
  const built = new Set<string>();
  for (const [id, e] of entries)
    if (e.indexable || (e.noindex_since !== null && e.redirect_to === null)) built.add(id);
  const parentOf = new Map(candidates.map((c) => [idOf(c), c.parent_url]));
  const landing = (c: PageCandidate): string | null => {
    let url = c.parent_url;
    for (let hops = 0; url !== null && hops < MAX_CLIMB; hops++) {
      const id = idOf({ host: c.host, locale: c.locale, url });
      if (built.has(id) || !entries.has(id)) return url;
      url = parentOf.get(id) ?? null;
    }
    return null;
  };
  for (const c of candidates) {
    const e = entries.get(idOf(c))!;
    if (e.redirect_to === null) continue;
    const to = landing(c);
    entries.set(idOf(c), { ...e, redirect_to: to, noindex_since: to === null ? null : e.noindex_since });
  }

  const candidateIds = new Set(candidates.map(idOf));
  for (const prev of snapshot.previous_manifest) {
    if (candidateIds.has(idOf(prev))) continue;
    if (!prev.indexable && prev.noindex_since === null) continue; // never published: nothing to keep alive
    const parent_url = nearestParent(prev, built);
    const zero = { evidence: 0, entities: 0, relevance: 0, unique: 0, seo: 0 };
    const gone: Assessment = {
      result: { gate_key: prev.gate.gate_key, scores: zero, passed: false, reasons: [GONE] },
      stay: false,
    };
    const decision = decide(gone, { parent_url }, prev, cfg, now);
    entries.set(idOf(prev), {
      ...prev,
      indexable: false,
      gate: decision.result,
      noindex_since: decision.noindex_since,
      redirect_to: decision.action === 'redirect_parent' ? parent_url : null,
    });
  }

  return [...entries.values()].sort(
    (a, b) => compareText(a.host + a.url, b.host + b.url) || compareText(a.locale, b.locale),
  );
}
