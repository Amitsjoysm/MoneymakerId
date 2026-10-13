// schema.org JSON-LD builders for the brand and the page frame: Organization, WebSite, WebPage, BreadcrumbList,
// ItemList and FAQPage (plan §12). Business nodes (Restaurant, LocalBusiness, Review) are in business-jsonld.ts.
//
// Rules: only fields that are known are written (an absent field is left out, never invented); every URL is
// absolute https; a list builder returns null when there is nothing to list; invalid input throws RangeError
// so a bad node fails the build instead of shipping. MarketMind AI's own contact point can only come from the
// Organization builder.
import type { Locale } from '../schema/index.ts';
import { BRAND_NAME } from './meta.ts';
import { canonicalUrl, normaliseUrl, siteOrigin } from './url.ts';

export const SCHEMA_CONTEXT = 'https://schema.org';

export type JsonLdValue = string | number | boolean | null | JsonLdValue[] | { [key: string]: JsonLdValue };
/** One top-level JSON-LD object: `@context`, `@type` and the properties of that type. */
export type JsonLdNode = { '@context': typeof SCHEMA_CONTEXT; '@type': string; [key: string]: JsonLdValue };

// --- helpers shared with business-jsonld.ts (not part of the public entry) -------------------------------------

/** A node with its `@context`; properties whose value is `undefined` are left out. */
export function jsonLdNode(type: string, props: Record<string, JsonLdValue | undefined>): JsonLdNode {
  const node: JsonLdNode = { '@context': SCHEMA_CONTEXT, '@type': type };
  for (const [key, value] of Object.entries(props)) if (value !== undefined) node[key] = value;
  return node;
}

/** A nested object (`@type` and properties, no `@context`); `undefined` properties are left out. */
export function jsonLdPart(
  type: string,
  props: Record<string, JsonLdValue | undefined>,
): { [key: string]: JsonLdValue } {
  const part: { [key: string]: JsonLdValue } = { '@type': type };
  for (const [key, value] of Object.entries(props)) if (value !== undefined) part[key] = value;
  return part;
}

/** Trimmed text with runs of whitespace collapsed; an empty value is a bug in the caller. */
export function jsonLdText(value: string, field: string): string {
  const out = value.replace(/\s+/g, ' ').trim();
  if (out === '') throw new RangeError(`JSON-LD: ${field} must not be empty`);
  return out;
}

/** The URL unchanged, after checking that it is an absolute https URL (for external links such as `sameAs`). */
export function jsonLdHttpsUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RangeError(`JSON-LD: ${field} must be an absolute https:// URL, got "${value}"`);
  }
  if (parsed.protocol !== 'https:') {
    throw new RangeError(`JSON-LD: ${field} must be an https:// URL, got "${value}"`);
  }
  return value;
}

export function jsonLdTimestamp(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value)))
    throw new RangeError(`JSON-LD: ${field} must be a date or timestamp, got "${value}"`);
  return value;
}

// --- Organization and WebSite --------------------------------------------------------------------------------

/** The id of the one brand entity, always on the main site, so every host points at the same Organization. */
export function organizationId(mainSiteUrl: string): string {
  return `${siteOrigin(mainSiteUrl)}/#organization`;
}

export function webSiteId(siteUrl: string): string {
  return `${siteOrigin(siteUrl)}/#website`;
}

export type ContactPointInput = {
  /** E.164, with or without the leading `+` (the `WHATSAPP_NUMBER` env value has none). */
  telephone: string;
  contactType: string;
  availableLanguage?: readonly string[];
};

export type OrganizationInput = {
  mainSiteUrl: string;
  description?: string;
  logoUrl?: string;
  /** Official profiles of the brand (https). */
  sameAs?: readonly string[];
  /** MarketMind AI's own contact point. No other builder takes one. */
  contactPoint?: ContactPointInput | null;
};

function contactPointPart(input: ContactPointInput): { [key: string]: JsonLdValue } {
  const digits = /^\+?([1-9]\d{7,14})$/.exec(input.telephone.trim());
  if (!digits)
    throw new RangeError(`JSON-LD: contact point telephone must be E.164, got "${input.telephone}"`);
  const languages = input.availableLanguage?.map((l) => jsonLdText(l, 'availableLanguage'));
  return jsonLdPart('ContactPoint', {
    telephone: `+${digits[1]}`,
    contactType: jsonLdText(input.contactType, 'contactType'),
    availableLanguage: languages !== undefined && languages.length > 0 ? languages : undefined,
  });
}

/** The brand `Organization` (name `MarketMind AI`, the main site as `url`). One id, shared by every host. */
export function organizationJsonLd(input: OrganizationInput): JsonLdNode {
  const sameAs = input.sameAs?.map((u) => jsonLdHttpsUrl(u, 'sameAs'));
  return jsonLdNode('Organization', {
    '@id': organizationId(input.mainSiteUrl),
    name: BRAND_NAME,
    url: canonicalUrl(input.mainSiteUrl, '/'),
    description: input.description === undefined ? undefined : jsonLdText(input.description, 'description'),
    logo:
      input.logoUrl === undefined
        ? undefined
        : jsonLdPart('ImageObject', { url: jsonLdHttpsUrl(input.logoUrl, 'logoUrl') }),
    sameAs: sameAs !== undefined && sameAs.length > 0 ? sameAs : undefined,
    contactPoint: input.contactPoint ? contactPointPart(input.contactPoint) : undefined,
  });
}

export type WebSiteInput = {
  siteUrl: string;
  mainSiteUrl: string;
  name: string;
  description?: string;
  locale?: Locale;
};

/** The `WebSite` of one host, published by the brand Organization. No search action: no search route exists. */
export function webSiteJsonLd(input: WebSiteInput): JsonLdNode {
  return jsonLdNode('WebSite', {
    '@id': webSiteId(input.siteUrl),
    url: canonicalUrl(input.siteUrl, '/'),
    name: jsonLdText(input.name, 'name'),
    description: input.description === undefined ? undefined : jsonLdText(input.description, 'description'),
    inLanguage: input.locale,
    publisher: { '@id': organizationId(input.mainSiteUrl) },
  });
}

// --- WebPage, BreadcrumbList, ItemList, FAQPage --------------------------------------------------------------

export type WebPageInput = {
  siteUrl: string;
  /** The manifest path of the page. */
  path: string;
  name: string;
  description: string;
  locale: Locale;
  type?: 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage';
  /** When the page's data last changed: the manifest's `hash_changed_at`. */
  dateModified?: string;
  /** True when the page also carries the BreadcrumbList from `breadcrumbListJsonLd`. */
  breadcrumb?: boolean;
};

export function webPageJsonLd(input: WebPageInput): JsonLdNode {
  const url = canonicalUrl(input.siteUrl, input.path);
  return jsonLdNode(input.type ?? 'WebPage', {
    '@id': `${url}#webpage`,
    url,
    name: jsonLdText(input.name, 'name'),
    description: jsonLdText(input.description, 'description'),
    inLanguage: input.locale,
    isPartOf: { '@id': webSiteId(input.siteUrl) },
    dateModified:
      input.dateModified === undefined ? undefined : jsonLdTimestamp(input.dateModified, 'dateModified'),
    breadcrumb: input.breadcrumb ? { '@id': `${url}#breadcrumb` } : undefined,
  });
}

export type NamedLink = { name: string; url: string };

/**
 * The visible trail, first crumb first and the current page last, each with an absolute URL (crumbs may sit on
 * another host: Home is on the main site). Identified by the current page's URL. Null for an empty trail.
 */
export function breadcrumbListJsonLd(items: readonly NamedLink[]): JsonLdNode | null {
  if (items.length === 0) return null;
  const elements = items.map((item, index) =>
    jsonLdPart('ListItem', {
      position: index + 1,
      name: jsonLdText(item.name, 'breadcrumb name'),
      item: normaliseUrl(item.url),
    }),
  );
  const last = elements[elements.length - 1]?.item;
  return jsonLdNode('BreadcrumbList', { '@id': `${String(last)}#breadcrumb`, itemListElement: elements });
}

/**
 * The organic list, in ranked order. Paid placements are not passed here: an ItemList is the organic ranking
 * (plan §8), and a sponsor never changes it. Null for an empty list.
 */
export function itemListJsonLd(input: { name?: string; items: readonly NamedLink[] }): JsonLdNode | null {
  if (input.items.length === 0) return null;
  return jsonLdNode('ItemList', {
    name: input.name === undefined ? undefined : jsonLdText(input.name, 'name'),
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, index) =>
      jsonLdPart('ListItem', {
        position: index + 1,
        name: jsonLdText(item.name, 'item name'),
        url: normaliseUrl(item.url),
      }),
    ),
  });
}

/** Plain FAQPage (the FAQs are for readers and AI engines, plan §12). Null for no questions. */
export function faqPageJsonLd(faqs: readonly { question: string; answer: string }[]): JsonLdNode | null {
  if (faqs.length === 0) return null;
  return jsonLdNode('FAQPage', {
    mainEntity: faqs.map((faq) =>
      jsonLdPart('Question', {
        name: jsonLdText(faq.question, 'question'),
        acceptedAnswer: jsonLdPart('Answer', { text: jsonLdText(faq.answer, 'answer') }),
      }),
    ),
  });
}

// --- embedding -----------------------------------------------------------------------------------------------

/** Several nodes as one `@graph` under a single `@context`. */
export function jsonLdGraph(nodes: readonly JsonLdNode[]): { [key: string]: JsonLdValue } {
  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': nodes.map(({ '@context': _context, ...rest }) => rest),
  };
}

const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

/**
 * The text for `<script type="application/ld+json">`: JSON with `<`, `>`, `&` and the JavaScript line separators
 * escaped, so no value can close the script element or break the page. An array becomes a `@graph`.
 */
export function serializeJsonLd(data: JsonLdNode | readonly JsonLdNode[]): string {
  const document = Array.isArray(data) ? jsonLdGraph(data as readonly JsonLdNode[]) : data;
  return JSON.stringify(document).replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char] ?? char);
}
