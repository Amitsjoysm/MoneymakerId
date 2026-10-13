// @mm/core/seo (owner C05a): titles and descriptions, canonical URLs and robots meta, schema.org JSON-LD builders,
// sitemap XML and llms.txt (CONTRACTS §6, §8a; plan §12). Pure and runtime-neutral (Node and Cloudflare Workers):
// the site URL, the manifest entries and every name come in as arguments; nothing here reads the environment.
export { BRAND_NAME, DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, pageMeta } from './meta.ts';
export type { PageMeta, PageMetaInput, PublicHost } from './meta.ts';
export { ROBOTS_INDEX, ROBOTS_NOINDEX, canonicalUrl, normaliseUrl, robotsMeta, siteOrigin } from './url.ts';
export type { RobotsMeta } from './url.ts';
export {
  breadcrumbListJsonLd,
  faqPageJsonLd,
  itemListJsonLd,
  jsonLdGraph,
  organizationId,
  organizationJsonLd,
  serializeJsonLd,
  webPageJsonLd,
  webSiteId,
  webSiteJsonLd,
} from './jsonld.ts';
export type {
  ContactPointInput,
  JsonLdNode,
  JsonLdValue,
  NamedLink,
  OrganizationInput,
  WebPageInput,
  WebSiteInput,
} from './jsonld.ts';
export { localBusinessJsonLd, restaurantJsonLd, reviewJsonLd } from './business-jsonld.ts';
export type { LocalBusinessContext, RatingEvidence, RestaurantContext } from './business-jsonld.ts';
export { SITEMAP_MAX_URLS, sitemapIndexXml, sitemapXml } from './sitemap.ts';
export type { SitemapEntry } from './sitemap.ts';
export { llmsTxt } from './llms.ts';
export type { LlmsTxtInput, LlmsTxtLink, LlmsTxtSection } from './llms.ts';
