// CONTRACTS §8a: page title and description templates (spec §38, §39). Other page types follow the same
// pattern and are defined by C05a in @mm/core/seo. Placeholders are filled by C05a.
import { deepFreeze } from './freeze.ts';

export const TITLE = deepFreeze({
  food: {
    dish_locality: 'Best {Dish} in {Locality}, Pune | MarketMind AI',
  },
  construction: {
    locality_service: '{Service} Cost in {Locality}, Pune | MarketMind AI',
    service_cost: '{Service} Cost in Pune | MarketMind AI',
    /** Used only for the house-construction cost guide (CONTRACTS §4a). */
    service_cost_per_sqft: '{Service} Cost per Sq Ft in Pune | MarketMind AI',
  },
} as const);

export const DESC = deepFreeze({
  food: 'Discover highly rated {dish} options in {locality}, Pune. Compare price, location, freshness and our latest recommendations.',
  construction:
    'Estimate {service} costs in {locality}, Pune, understand pricing factors and find local providers for quotes.',
} as const);
