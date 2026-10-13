// Every candidate page of every host (CONTRACTS §6 and §11), in a fixed order. English only: the Marathi and Hindi
// pages are M6. The seam for them is `enumerateCandidates`: when i18n lands, emit each page once per locale here (the
// URL gets its `/mr` or `/hi` prefix and the `i18n:{locale}:{url}` prose key joins `prose_keys`). Every enumerator
// sets `locale: 'en'` explicitly, so none of them has to change for that.
import type { CatalogueSnapshot, PageCandidate } from '../schema/index.ts';
import { buildCatalogue } from './catalogue.ts';
import { constructionCandidates } from './construction.ts';
import { foodCandidates } from './food.ts';
import { mainCandidates } from './main-site.ts';

const pageId = (c: Pick<PageCandidate, 'host' | 'locale' | 'url'>): string =>
  `${c.host} ${c.locale} ${c.url}`;

/**
 * The pages the catalogue supports, as candidates for the gate. Sorted by host, then URL, and independent of the order
 * of the snapshot's lists. Throws when two pages would live at one URL (a slug collision Astro could not route).
 */
export function enumerateCandidates(snapshot: CatalogueSnapshot, now: Date): PageCandidate[] {
  const cat = buildCatalogue(snapshot, now);
  const all = [...mainCandidates(cat), ...constructionCandidates(cat), ...foodCandidates(cat)];
  all.sort((a, b) => {
    const x = a.host + a.url;
    const y = b.host + b.url;
    return x < y ? -1 : x > y ? 1 : 0;
  });
  for (let i = 1; i < all.length; i++) {
    const [a, b] = [all[i - 1]!, all[i]!];
    if (pageId(a) === pageId(b)) {
      throw new Error(`duplicate page ${a.host} ${a.url} (${a.page_type} and ${b.page_type})`);
    }
  }
  return all;
}
