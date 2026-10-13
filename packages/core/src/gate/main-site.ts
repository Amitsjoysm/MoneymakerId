// Page candidates of marketmindai.com (CONTRACTS §11): the home page and the Pune locality guides. The trust and
// policy pages (about, contact, privacy, ...) are static and always built, so they are not candidates.
import { TIER_TTL_DAYS } from '../constants/index.ts';
import type { PageCandidate } from '../schema/index.ts';
import { compareText, type Catalogue } from './catalogue.ts';
import { demandIndex, ageFreshness, meanFill, seoInputs } from './seo-inputs.ts';
import { plainText, wordCount } from './text.ts';

const HOST = 'main';
/** A guide counts as fully sourced at this many sources (the data_quality scale). */
const WELL_SOURCED = 3;

export function mainCandidates(cat: Catalogue): PageCandidate[] {
  const demand = demandIndex(cat.snapshot.demand);
  const localityById = new Map(cat.localities.map((l) => [l.id, l]));
  const guides = [...cat.snapshot.locality_guides].sort((a, b) => compareText(a.locality_id, b.locality_id));

  const out: PageCandidate[] = [
    {
      url: '/',
      host: HOST,
      locale: 'en',
      page_type: 'home',
      parent_url: null,
      entity_ids: [],
      evidence_count: 0,
      entity_count: 0,
      relevance: 1,
      main_text: '',
      data_inputs: { page: 'home' },
      prose_keys: [],
      // The home page is not scored: nothing is measured, so every input is 0 rather than a made-up number.
      seo_inputs: {
        demand: 0,
        data_quality: 0,
        locality_specificity: 0,
        commercial_intent: 0,
        content_depth: 0,
        freshness: 0,
      },
      extra: {},
    },
  ];

  for (const guide of guides) {
    const locality = localityById.get(guide.locality_id);
    if (locality === undefined) continue; // a guide for a locality that is not in the catalogue has nowhere to link
    const text = plainText(guide.body_md);
    const sources = [...guide.sources].sort((a, b) => compareText(a.url, b.url));
    out.push({
      url: `/pune/${locality.id}/`,
      host: HOST,
      locale: 'en',
      page_type: 'locality_guide',
      parent_url: '/pune/',
      entity_ids: [],
      evidence_count: guide.sources.length,
      entity_count: 0,
      relevance: 1,
      main_text: text,
      data_inputs: {
        locality: { id: locality.id, name: locality.name },
        title: guide.title,
        body_md: guide.body_md,
        sources,
      },
      prose_keys: [`locality:${locality.id}:guide`],
      seo_inputs: seoInputs({
        key: 'main:locality_guide',
        demand: demand.locality(locality.id),
        data_quality: meanFill([[guide.sources.length, WELL_SOURCED]]),
        local: true,
        freshness: ageFreshness(
          guide.sources.map((s) => s.retrieved_at),
          TIER_TTL_DAYS.COLD,
          cat.now,
        ),
        text,
      }),
      extra: { words: wordCount(text) },
    });
  }
  return out;
}
