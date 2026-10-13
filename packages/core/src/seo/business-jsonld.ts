// schema.org JSON-LD for businesses: Restaurant (a place), LocalBusiness (a provider) and Review (a first-hand
// experience). Plan §12 and spec §43: structured data only when accurate.
//
// - Restaurant and LocalBusiness need an address; without one the builder returns null (no markup at all).
// - Only fields present in the view are written. `aggregateRating` comes only from an evidence count passed in,
//   and `Review` only from first-hand experiences passed in. Nothing is estimated, defaulted or invented.
// - CONTRACTS §7: MarketMind AI's WhatsApp number never appears in business data or business JSON-LD. The views
//   carry no phone, and as a second line of defence every builder throws if the number shows up in any text.
import type { ExperienceView, OpeningHours, PlaceView, ProviderView, Weekday } from '../schema/index.ts';
import { WHATSAPP_NUMBER } from '../leads/index.ts';
import { jsonLdNode, jsonLdPart, jsonLdText, type JsonLdNode, type JsonLdValue } from './jsonld.ts';
import { BRAND_NAME } from './meta.ts';
import { canonicalUrl, normaliseUrl } from './url.ts';

/** Ratings in the snapshot are whole stars on a 1 to 5 scale (CONTRACTS §5 `experiences`). */
const BEST_RATING = 5;
const WORST_RATING = 1;

/** Real rating evidence: the mean of `count` first-hand ratings. Zero means there is none. */
export type RatingEvidence = { value: number; count: number };

export type RestaurantContext = {
  siteUrl: string;
  /** The manifest path of the place page. */
  path: string;
  rating?: RatingEvidence | null;
  /** First-hand experiences; those of other businesses are ignored. */
  experiences?: readonly ExperienceView[];
};

export type LocalBusinessContext = {
  siteUrl: string;
  path: string;
  /** A provider view has no address. Pass one only if it is sourced; without it there is no LocalBusiness markup. */
  address: string | null;
  serviceNames: readonly string[];
  areaServedNames: readonly string[];
};

// --- the WhatsApp guard --------------------------------------------------------------------------------------

/** The number without its country code: what an owner would type or a visitor would see (`98343 46179`). */
const NATIONAL_DIGITS = WHATSAPP_NUMBER.slice(-10);

function assertNoBrandNumber(value: JsonLdValue, where: string): void {
  if (typeof value === 'string') {
    if (value.replace(/\D/g, '').includes(NATIONAL_DIGITS)) {
      throw new RangeError(`${where}: MarketMind AI's contact number must not appear in business JSON-LD`);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) assertNoBrandNumber(item, where);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) assertNoBrandNumber(item, where);
  }
}

function guarded(node: JsonLdNode, where: string): JsonLdNode {
  assertNoBrandNumber(node, where);
  return node;
}

// --- parts ---------------------------------------------------------------------------------------------------

function postalAddress(address: string): { [key: string]: JsonLdValue } {
  // MarketMind AI covers Pune only, so city, state and country are facts of the product, not of the business.
  return jsonLdPart('PostalAddress', {
    streetAddress: jsonLdText(address, 'address'),
    addressLocality: 'Pune',
    addressRegion: 'Maharashtra',
    addressCountry: 'IN',
  });
}

const WEEK: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAME: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** One specification per opening interval, Monday first. Closed and unknown days write nothing. */
function openingHoursParts(hours: OpeningHours | null): JsonLdValue[] | undefined {
  if (hours === null) return undefined;
  const parts: JsonLdValue[] = [];
  for (const day of WEEK) {
    for (const [opens, closes] of hours[day] ?? []) {
      parts.push(jsonLdPart('OpeningHoursSpecification', { dayOfWeek: DAY_NAME[day], opens, closes }));
    }
  }
  return parts.length > 0 ? parts : undefined;
}

function aggregateRatingPart(rating: RatingEvidence | null | undefined): JsonLdValue | undefined {
  if (!rating || rating.count === 0) return undefined;
  if (!Number.isInteger(rating.count) || rating.count < 0) {
    throw new RangeError(`aggregateRating: count must be a whole number of ratings, got ${rating.count}`);
  }
  if (!Number.isFinite(rating.value) || rating.value < WORST_RATING || rating.value > BEST_RATING) {
    throw new RangeError(
      `aggregateRating: value must be between ${WORST_RATING} and ${BEST_RATING}, got ${rating.value}`,
    );
  }
  return jsonLdPart('AggregateRating', {
    ratingValue: rating.value,
    ratingCount: rating.count,
    bestRating: BEST_RATING,
    worstRating: WORST_RATING,
  });
}

/**
 * The properties of a Review of a first-hand experience. The rating is always written; the text only once the
 * experience's prose is reviewed (a draft is not published) and only if there is some.
 */
function reviewProps(experience: ExperienceView): Record<string, JsonLdValue | undefined> {
  const body = experience.prose_status === 'reviewed' ? experience.notes.replace(/\s+/g, ' ').trim() : '';
  return {
    author: jsonLdPart('Organization', { name: BRAND_NAME }),
    datePublished: experience.visited_at,
    reviewRating: jsonLdPart('Rating', {
      ratingValue: experience.overall_rating,
      bestRating: BEST_RATING,
      worstRating: WORST_RATING,
    }),
    reviewBody: body === '' ? undefined : body,
  };
}

// --- builders ------------------------------------------------------------------------------------------------

/**
 * A `Restaurant` for a place page, or null when the place has no address. The page URL is the node's `url`; the
 * place's own website is `sameAs`. There is no telephone: the view has none.
 */
export function restaurantJsonLd(place: PlaceView, context: RestaurantContext): JsonLdNode | null {
  if (place.address === null || place.address.trim() === '') return null;
  const url = canonicalUrl(context.siteUrl, context.path);
  const reviews = (context.experiences ?? [])
    .filter((experience) => experience.business_id === place.id)
    .map((experience) => jsonLdPart('Review', reviewProps(experience)));
  const node = jsonLdNode('Restaurant', {
    '@id': `${url}#restaurant`,
    name: jsonLdText(place.name, 'name'),
    url,
    sameAs: place.website === null ? undefined : [place.website],
    address: postalAddress(place.address),
    geo:
      place.geo === null
        ? undefined
        : jsonLdPart('GeoCoordinates', { latitude: place.geo.lat, longitude: place.geo.lng }),
    servesCuisine:
      place.cuisines.length > 0 ? place.cuisines.map((c) => jsonLdText(c, 'cuisine')) : undefined,
    priceRange: place.price_level === null ? undefined : '₹'.repeat(place.price_level),
    openingHoursSpecification: openingHoursParts(place.opening_hours),
    aggregateRating: aggregateRatingPart(context.rating),
    review: reviews.length > 0 ? reviews : undefined,
  });
  return guarded(node, 'restaurantJsonLd');
}

/**
 * A `LocalBusiness` for a provider page, or null without an address. Services become offers without a price;
 * the localities served become `areaServed`. Providers carry no phone, rating or review.
 */
export function localBusinessJsonLd(
  provider: ProviderView,
  context: LocalBusinessContext,
): JsonLdNode | null {
  if (context.address === null || context.address.trim() === '') return null;
  const url = canonicalUrl(context.siteUrl, context.path);
  const node = jsonLdNode('LocalBusiness', {
    '@id': `${url}#localbusiness`,
    name: jsonLdText(provider.name, 'name'),
    url,
    address: postalAddress(context.address),
    areaServed:
      context.areaServedNames.length > 0
        ? context.areaServedNames.map((name) =>
            jsonLdPart('Place', { name: jsonLdText(name, 'area served') }),
          )
        : undefined,
    makesOffer:
      context.serviceNames.length > 0
        ? context.serviceNames.map((name) =>
            jsonLdPart('Offer', {
              itemOffered: jsonLdPart('Service', { name: jsonLdText(name, 'service') }),
            }),
          )
        : undefined,
  });
  return guarded(node, 'localBusinessJsonLd');
}

/** A standalone `Review` of the item a first-hand experience is about. The author is MarketMind AI. */
export function reviewJsonLd(
  experience: ExperienceView,
  item: { type: 'Restaurant' | 'LocalBusiness'; name: string; url: string },
): JsonLdNode {
  const node = jsonLdNode('Review', {
    itemReviewed: jsonLdPart(item.type, {
      name: jsonLdText(item.name, 'item name'),
      url: normaliseUrl(item.url),
    }),
    ...reviewProps(experience),
  });
  return guarded(node, 'reviewJsonLd');
}
