// Page titles and meta descriptions for every page type (CONTRACTS §8a, spec §38 and §39, plan §12).
// The §8a page types (dish_locality, locality_service, service_cost) are filled from the TITLE and DESC literals in
// @mm/core/constants and must equal them exactly. Every other page type follows the same `… | MarketMind AI` pattern
// with its own short template. The text is plain: the page template escapes it for HTML.
import { COST_DISCLAIMER, DESC, TITLE } from '../constants/index.ts';
import type { FoodIntent, Host, LocalityFoodIntent } from '../schema/index.ts';

export const BRAND_NAME = 'MarketMind AI';
/** Search results cut longer titles; the build check warns above this. Long names can still overshoot it (see the tests). */
export const TITLE_MAX_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 160;

export type PublicHost = Exclude<Host, 'admin'>;
export type PageMeta = { title: string; description: string };

/**
 * What each page type needs. Names are display names ("Pimple Saudagar", "Chicken Biryani"), not ids. `legal` and
 * `business` pages are editorial, so their page supplies its own description rather than this module inventing one.
 */
export type PageMetaInput =
  | { page_type: 'home'; host: PublicHost }
  | { page_type: 'city_hub'; host: PublicHost }
  | { page_type: 'locality_hub'; host: 'food' | 'construction'; locality: string }
  | { page_type: 'locality_guide'; locality: string }
  | { page_type: 'dish_city'; dish: string }
  | { page_type: 'dish_locality'; dish: string; locality: string }
  | { page_type: 'food_intent'; dish: string; locality: string; intent: FoodIntent }
  | { page_type: 'locality_food_intent'; locality: string; intent: LocalityFoodIntent }
  | { page_type: 'place'; name: string; locality: string }
  | { page_type: 'service_cost'; service: string; service_id: string }
  | { page_type: 'service_city'; service: string }
  | { page_type: 'locality_service'; service: string; locality: string }
  | { page_type: 'provider'; name: string; locality: string }
  | { page_type: 'calculator' }
  | { page_type: 'get_quotes' }
  | { page_type: 'for_contractors' }
  | { page_type: 'ask'; host: 'food' | 'construction' }
  | { page_type: 'legal'; name: string; description: string }
  | { page_type: 'business'; name: string; description: string }
  | { page_type: 'contact' }
  | { page_type: 'about' }
  | { page_type: 'not_found' }
  | { page_type: 'thank_you' };

/** The one cost guide titled "per Sq Ft" (CONTRACTS §4a, plan §6). */
const PER_SQFT_SERVICE_ID = 'house-construction';

/** The sentence every food description ends with, as in DESC.food (spec §39). */
const FOOD_TAIL = 'Compare price, location, freshness and our latest recommendations.';
const CONSTRUCTION_TAIL = 'understand pricing factors and find local providers for quotes.';

const brand = (core: string): string => `${core} | ${BRAND_NAME}`;

/** Trims and collapses whitespace, and refuses an empty name: a title with a hole in it must fail the build. */
function clean(value: string, field: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text === '') throw new RangeError(`pageMeta: ${field} must not be empty`);
  return text;
}

/** Fills `{Name}` placeholders in one pass, so a value containing braces or `$` is never re-read as syntax. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new RangeError(`pageMeta: no value for {${key}}`);
    return value;
  });
}

function pick<T>(table: Readonly<Record<string, T>>, key: string, what: string): T {
  if (!Object.hasOwn(table, key)) throw new RangeError(`pageMeta: ${what} "${key}" is not supported`);
  return table[key] as T;
}

// --- fixed copy for pages without a name in their title ------------------------------------------------------

const HOME: Record<PublicHost, PageMeta> = {
  main: {
    title: brand('Pune Food and Construction Guides'),
    description:
      'MarketMind AI is a Pune local decision engine. Compare dishes by locality and construction costs, with the source and date checked for every claim.',
  },
  food: {
    title: brand('Find the Best Food in Pune by Locality'),
    description:
      'Find the best dishes in Pune by locality. Compare price, location and freshness, with the source and date checked shown for every claim.',
  },
  construction: {
    title: brand('Construction Cost Guides and Quotes in Pune'),
    description:
      'Cited cost guides for waterproofing, painting, bathroom, kitchen and house construction in Pune, plus a calculator and local providers for quotes.',
  },
};

const CITY_HUB: Record<PublicHost, PageMeta> = {
  main: {
    title: brand('Pune Locality Guides'),
    description:
      'Local guides to the localities of Pune, with the facts we checked, where each one comes from and links to our food and construction guides.',
  },
  food: {
    title: brand('Best Food in Pune'),
    description: `Browse the best dishes in Pune and the localities that serve them. ${FOOD_TAIL}`,
  },
  construction: {
    title: brand('Construction Costs in Pune'),
    description:
      'Compare construction and renovation costs in Pune by service and locality, with the sources behind every rate and the date it was checked.',
  },
};

const ASK: Record<'food' | 'construction', PageMeta> = {
  food: {
    title: brand('Ask About Food in Pune'),
    description:
      'Ask a question about food in Pune. Answers come from our checked data first, and every source is shown.',
  },
  construction: {
    title: brand('Ask About Construction in Pune'),
    description:
      'Ask a question about construction costs and providers in Pune. Answers come from our checked data first, and every source is shown.',
  },
};

const CALCULATOR: PageMeta = {
  title: brand('Construction Cost Calculator for Pune'),
  description: `Estimate home construction and renovation costs in Pune from cited rates. ${COST_DISCLAIMER}`,
};

const GET_QUOTES: PageMeta = {
  title: brand('Get Construction Quotes in Pune'),
  description:
    'Request a quote for waterproofing, painting, bathroom, kitchen or house construction work in Pune.',
};

const FOR_CONTRACTORS: PageMeta = {
  title: brand('For Contractors: Get Quote Requests in Pune'),
  description:
    'Pune contractors can receive quote requests from homeowners in their service areas through MarketMind AI.',
};

const CONTACT: PageMeta = {
  title: brand('Contact Us'),
  description: 'Contact MarketMind AI with a question, a correction or a request about a listing.',
};

const ABOUT: PageMeta = {
  title: brand('About Us'),
  description:
    'How MarketMind AI collects, checks and dates its Pune food and construction information, and how paid placement is labelled.',
};

const NOT_FOUND: PageMeta = {
  title: brand('Page Not Found'),
  description: 'This page does not exist or has moved. Try the Pune food or construction guides.',
};

const THANK_YOU: PageMeta = {
  title: brand('Thank You'),
  description: 'Thank you. We have received your request.',
};

// --- food intents --------------------------------------------------------------------------------------------

function foodIntentMeta(dish: string, locality: string, intent: FoodIntent): PageMeta {
  const where = `in ${locality}, Pune`;
  const lower = dish.toLowerCase();
  const under = /^under-([1-9]\d*)$/.exec(intent);
  if (under) {
    const limit = `₹${under[1]}`;
    return {
      title: brand(`${dish} Under ${limit} ${where}`),
      description: `Discover highly rated ${lower} options under ${limit} ${where}. ${FOOD_TAIL}`,
    };
  }
  const intents: Record<string, PageMeta> = {
    veg: {
      title: brand(`Veg ${dish} ${where}`),
      description: `Discover highly rated vegetarian ${lower} options ${where}. ${FOOD_TAIL}`,
    },
    'late-night': {
      title: brand(`Late-Night ${dish} ${where}`),
      description: `Discover ${lower} options ${where} with late-night hours we have checked. ${FOOD_TAIL}`,
    },
    family: {
      title: brand(`Family-Friendly ${dish} ${where}`),
      description: `Discover highly rated ${lower} options ${where} that suit families. ${FOOD_TAIL}`,
    },
    'office-lunch': {
      title: brand(`${dish} for Office Lunch ${where}`),
      description: `Discover highly rated ${lower} options ${where} that work for an office lunch. ${FOOD_TAIL}`,
    },
  };
  return pick(intents, intent, 'food intent');
}

function localityFoodIntentMeta(locality: string, intent: LocalityFoodIntent): PageMeta {
  const where = `in ${locality}, Pune`;
  const intents: Record<LocalityFoodIntent, PageMeta> = {
    'late-night-food': {
      title: brand(`Late-Night Food ${where}`),
      description: `Find food ${where} with late-night hours we have checked. ${FOOD_TAIL}`,
    },
    'budget-food': {
      title: brand(`Budget Food ${where}`),
      description: `Find affordable dishes ${where}, with the price and the date it was checked. ${FOOD_TAIL}`,
    },
    'veg-food': {
      title: brand(`Veg Food ${where}`),
      description: `Find vegetarian dishes ${where}. ${FOOD_TAIL}`,
    },
  };
  return pick(intents, intent, 'locality food intent');
}

// --- the public function -------------------------------------------------------------------------------------

/**
 * The `<title>` and meta description of a page. §8a page types equal the contract literals exactly; names are
 * inserted as given (after trimming), with dish and service names lowercased inside descriptions as the literals do.
 * Titles of long names can pass `TITLE_MAX_LENGTH`: the literals are never shortened to fit.
 */
export function pageMeta(input: PageMetaInput): PageMeta {
  switch (input.page_type) {
    case 'home':
      return pick(HOME, input.host, 'home host');
    case 'city_hub':
      return pick(CITY_HUB, input.host, 'city hub host');
    case 'ask':
      return pick(ASK, input.host, 'ask host');
    case 'locality_hub': {
      const locality = clean(input.locality, 'locality');
      if (input.host === 'food') {
        return {
          title: brand(`Best Food in ${locality}, Pune`),
          description: `Explore the best dishes in ${locality}, Pune. ${FOOD_TAIL}`,
        };
      }
      if (input.host === 'construction') {
        return {
          title: brand(`Construction Costs in ${locality}, Pune`),
          description: `Compare construction and renovation costs in ${locality}, Pune, ${CONSTRUCTION_TAIL}`,
        };
      }
      throw new RangeError(`pageMeta: locality hub host "${String(input.host)}" is not supported`);
    }
    case 'locality_guide': {
      const locality = clean(input.locality, 'locality');
      return {
        title: brand(`${locality}, Pune: Local Guide`),
        description: `A local guide to ${locality}, Pune: the facts we checked, where each one comes from and the date we checked it.`,
      };
    }
    case 'dish_city': {
      const dish = clean(input.dish, 'dish');
      return {
        title: brand(`Best ${dish} in Pune`),
        description: `Discover highly rated ${dish.toLowerCase()} options in Pune. ${FOOD_TAIL}`,
      };
    }
    case 'dish_locality': {
      const dish = clean(input.dish, 'dish');
      const locality = clean(input.locality, 'locality');
      return {
        title: fill(TITLE.food.dish_locality, { Dish: dish, Locality: locality }),
        description: fill(DESC.food, { dish: dish.toLowerCase(), locality }),
      };
    }
    case 'food_intent':
      return foodIntentMeta(clean(input.dish, 'dish'), clean(input.locality, 'locality'), input.intent);
    case 'locality_food_intent':
      return localityFoodIntentMeta(clean(input.locality, 'locality'), input.intent);
    case 'place': {
      const name = clean(input.name, 'name');
      const locality = clean(input.locality, 'locality');
      return {
        title: brand(`${name} in ${locality}, Pune`),
        description: `What we know about ${name} in ${locality}, Pune, where each detail comes from and when we last checked it.`,
      };
    }
    case 'service_cost': {
      const service = clean(input.service, 'service');
      const perSqFt = input.service_id === PER_SQFT_SERVICE_ID;
      return {
        title: fill(perSqFt ? TITLE.construction.service_cost_per_sqft : TITLE.construction.service_cost, {
          Service: service,
        }),
        description: `Estimate ${service.toLowerCase()} costs${perSqFt ? ' per sq ft' : ''} in Pune, ${CONSTRUCTION_TAIL}`,
      };
    }
    case 'service_city': {
      const service = clean(input.service, 'service');
      return {
        title: brand(`${service} Providers in Pune`),
        description: `Compare ${service.toLowerCase()} providers in Pune by service area and specialisation, then request quotes from the ones that fit.`,
      };
    }
    case 'locality_service': {
      const service = clean(input.service, 'service');
      const locality = clean(input.locality, 'locality');
      return {
        title: fill(TITLE.construction.locality_service, { Service: service, Locality: locality }),
        description: fill(DESC.construction, { service: service.toLowerCase(), locality }),
      };
    }
    case 'provider': {
      const name = clean(input.name, 'name');
      const locality = clean(input.locality, 'locality');
      return {
        title: brand(`${name} in ${locality}, Pune`),
        description: `See the services and service areas listed for ${name} in ${locality}, Pune, and request a quote.`,
      };
    }
    case 'calculator':
      return CALCULATOR;
    case 'get_quotes':
      return GET_QUOTES;
    case 'for_contractors':
      return FOR_CONTRACTORS;
    case 'legal':
    case 'business':
      return {
        title: brand(clean(input.name, 'name')),
        description: clean(input.description, 'description'),
      };
    case 'contact':
      return CONTACT;
    case 'about':
      return ABOUT;
    case 'not_found':
      return NOT_FOUND;
    case 'thank_you':
      return THANK_YOU;
    default:
      throw new RangeError(
        `pageMeta: page type "${String((input as { page_type: unknown }).page_type)}" is not supported`,
      );
  }
}
