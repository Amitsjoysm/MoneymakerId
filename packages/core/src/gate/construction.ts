// Page candidates of construction.marketmindai.com (CONTRACTS §11): cost guides, contractor pages, locality hubs and
// locality x service pages. A candidate is "something that could be built"; whether it is, is the gate's decision.
import { TIER_TTL_DAYS } from '../constants/index.ts';
import type { LocalFact, PageCandidate, ProviderView } from '../schema/index.ts';
import { compareText, type Catalogue, type ServiceNode } from './catalogue.ts';
import { factInputs, modelInputs, providerInputs, serviceInputs } from './inputs.ts';
import {
  ageFreshness,
  demandIndex,
  meanFill,
  meanOf,
  modelFreshness,
  rowFreshness,
  seoInputs,
  type DemandIndex,
} from './seo-inputs.ts';
import { joinText } from './text.ts';

const HOST = 'construction';
const CITY_URL = '/pune/';
/** The local-substance thresholds of the plan's gate path (c)/(a)/(b)/(d); data_quality is how much of them is filled. */
const SUBSTANCE_FULL = { facts: 3, providers: 2, quotes: 3, factor_sources: 2 } as const;

const unique = (items: readonly string[]): string[] => [...new Set(items)].sort(compareText);
const serves = (p: ProviderView, localityId: string): boolean =>
  p.locality_id === localityId || p.service_localities.includes(localityId);

function guidance(node: ServiceNode): string[] {
  const { questions_to_ask, common_mistakes, quote_checklist, faq } = node.def;
  return [...questions_to_ask, ...common_mistakes, ...quote_checklist, ...faq.flatMap((f) => [f.q, f.a])];
}

const providerText = (providers: readonly ProviderView[]): string[] =>
  providers.map((p) => joinText([p.name, p.specializations.join(', ')]));

export function constructionCandidates(cat: Catalogue): PageCandidate[] {
  const out: PageCandidate[] = [];
  const demand: DemandIndex = demandIndex(cat.snapshot.demand);
  const quotes = [...cat.snapshot.quote_stats].sort(
    (a, b) => compareText(a.service_id, b.service_id) || compareText(a.locality_id, b.locality_id),
  );
  const providerRows = (providers: readonly ProviderView[]) =>
    providers.flatMap((p) => cat.live.get(p.id) ?? []);
  // A provider counts, is listed and is shown only while at least one live, non-aggregator evidence row backs it
  // (plan §5 path (b): "providers serving the locality with evidence").
  const evidenced = cat.providers.filter((p) => providerRows([p]).length > 0);

  // Localities with any construction data of their own: facts, an evidenced provider that serves them, quotes or a
  // locality factor.
  const localLocalities = cat.localities.filter(
    (l) =>
      l.construction_facts.length > 0 ||
      evidenced.some((p) => serves(p, l.id)) ||
      quotes.some((q) => q.locality_id === l.id) ||
      cat.models.some((m) => m.locality_factors.some((f) => f.locality_id === l.id)),
  );

  for (const node of cat.services) {
    const id = node.def.id;
    const models = cat.models.filter((m) => node.ids.includes(m.service_id));
    const offering = evidenced.filter((p) => p.services.some((s) => node.ids.includes(s)));
    const publishers = unique(models.flatMap((m) => m.sources.map((s) => s.publisher.trim().toLowerCase())));
    const sourceUrls = unique(models.flatMap((m) => m.sources.map((s) => s.url)));
    const modelsFresh =
      models.length > 0
        ? modelFreshness(
            models.map((m) => m.valid_until),
            cat.now,
          )
        : null;

    // --- /pune/{service}-cost/ ---
    const costText = joinText([...guidance(node), ...models.map((m) => m.notes)]);
    out.push({
      url: `/pune/${id}-cost/`,
      host: HOST,
      locale: 'en',
      page_type: 'service_cost',
      parent_url: CITY_URL,
      entity_ids: [],
      evidence_count: sourceUrls.length,
      entity_count: models.length,
      relevance: models.length > 0 ? 1 : 0,
      main_text: costText,
      data_inputs: { service: serviceInputs(node.def), models: models.map((m) => modelInputs(m, null)) },
      prose_keys: [`service:${id}`, ...models.map((m) => `cost_model:${m.id}`)].sort(compareText),
      seo_inputs: seoInputs({
        key: 'construction:service_cost',
        demand: demand.subjects(node.ids, null),
        data_quality: meanFill([[publishers.length, 4]]),
        local: false,
        freshness: modelsFresh ?? 0,
        text: costText,
      }),
      extra: { sources: publishers.length, models: models.length },
    });

    // --- /pune/{service}/ : contractors, only where a provider offers the service (or one of its sub-services) ---
    if (offering.length > 0) {
      const rows = providerRows(offering);
      const text = joinText(providerText(offering));
      out.push({
        url: `/pune/${id}/`,
        host: HOST,
        locale: 'en',
        page_type: 'service_city',
        parent_url: CITY_URL,
        entity_ids: offering.map((p) => p.id),
        evidence_count: rows.length,
        entity_count: offering.length,
        relevance: 1,
        main_text: text,
        data_inputs: { service: { id, name: node.def.name }, providers: providerInputs(offering) },
        prose_keys: [`service:${id}`],
        seo_inputs: seoInputs({
          key: 'construction:service_city',
          demand: demand.subjects(node.ids, null),
          data_quality: meanFill([[rows.length, 3]]),
          local: false,
          freshness: rowFreshness(rows, cat.now),
          text,
        }),
        extra: { providers: offering.length },
      });
    }

    // --- /pune/{locality}/{service}/ ---
    for (const locality of localLocalities) {
      const facts = locality.construction_facts.filter((f) => f.services.includes(id));
      const providers = offering.filter((p) => serves(p, locality.id));
      const rows = providerRows(providers);
      const quote = quotes.find((q) => q.service_id === id && q.locality_id === locality.id) ?? null;
      // A locality factor of exactly 1 is the default, so it is no local substance; count the sources of the best other one.
      const factorSources = models.reduce((best, m) => {
        const factor = m.locality_factors.find((f) => f.locality_id === locality.id);
        if (factor === undefined || factor.factor === 1) return best;
        return Math.max(best, new Set(factor.sources.map((s) => s.url)).size);
      }, 0);
      const extra = {
        local_facts: facts.length,
        providers: providers.length,
        quotes: quote?.n ?? 0,
        factor_sources: factorSources,
      };
      const text = joinText([...facts.map((f) => f.text), ...providerText(providers)]);
      out.push({
        url: `/pune/${locality.id}/${id}/`,
        host: HOST,
        locale: 'en',
        page_type: 'locality_service',
        parent_url: `/pune/${locality.id}/`,
        entity_ids: providers.map((p) => p.id),
        evidence_count: facts.length + rows.length + extra.quotes + factorSources,
        entity_count: providers.length,
        relevance: models.length > 0 ? 1 : 0,
        main_text: text,
        data_inputs: {
          service: serviceInputs(node.def),
          locality: { id: locality.id, name: locality.name },
          facts: factInputs(facts),
          providers: providerInputs(providers),
          quotes: quote === null ? null : { n: quote.n, low: quote.low, high: quote.high },
          models: models.map((m) => modelInputs(m, locality.id)),
        },
        prose_keys: [`service:${id}`, ...(facts.length > 0 ? [`locality:${locality.id}:facts`] : [])].sort(
          compareText,
        ),
        seo_inputs: seoInputs({
          key: 'construction:locality_service',
          demand: demand.subjects(node.ids, locality.id),
          data_quality: meanFill([
            [extra.local_facts, SUBSTANCE_FULL.facts],
            [extra.providers, SUBSTANCE_FULL.providers],
            [extra.quotes, SUBSTANCE_FULL.quotes],
            [extra.factor_sources, SUBSTANCE_FULL.factor_sources],
          ]),
          local: true,
          freshness: meanOf([
            modelsFresh,
            facts.length > 0 ? factsFreshness(facts, cat.now) : null,
            rows.length > 0 ? rowFreshness(rows, cat.now) : null,
          ]),
          text,
        }),
        extra,
      });
    }
  }

  // --- /pune/{locality}/ ---
  for (const locality of localLocalities) {
    const facts = locality.construction_facts;
    const providers = evidenced.filter((p) => serves(p, locality.id));
    const rows = providerRows(providers);
    const text = joinText([...facts.map((f) => f.text), ...providerText(providers)]);
    out.push({
      url: `/pune/${locality.id}/`,
      host: HOST,
      locale: 'en',
      page_type: 'locality_hub',
      parent_url: CITY_URL,
      entity_ids: providers.map((p) => p.id),
      evidence_count: facts.length + rows.length,
      entity_count: providers.length,
      relevance: 1,
      main_text: text,
      data_inputs: {
        locality: { id: locality.id, name: locality.name },
        facts: factInputs(facts),
        providers: providerInputs(providers),
      },
      prose_keys: facts.length > 0 ? [`locality:${locality.id}:facts`] : [],
      seo_inputs: seoInputs({
        key: 'construction:locality_hub',
        demand: demand.locality(locality.id),
        data_quality: meanFill([
          [facts.length, SUBSTANCE_FULL.facts],
          [providers.length, SUBSTANCE_FULL.providers],
        ]),
        local: true,
        freshness: meanOf([
          facts.length > 0 ? factsFreshness(facts, cat.now) : null,
          rows.length > 0 ? rowFreshness(rows, cat.now) : null,
        ]),
        text,
      }),
      extra: { local_facts: facts.length, providers: providers.length },
    });
  }

  return out;
}

/** Facts age by the retrieval dates of their sources (COLD tier). */
function factsFreshness(facts: readonly LocalFact[], now: Date): number {
  return ageFreshness(
    facts.flatMap((f) => f.sources.map((s) => s.retrieved_at)),
    TIER_TTL_DAYS.COLD,
    now,
  );
}
