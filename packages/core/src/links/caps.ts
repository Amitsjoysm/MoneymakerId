// How many links of each kind a page gets (plan §12: a page links to what helps the visitor, not to everything).
// One place, so a page template, a test and a reviewer all read the same numbers.

/** Parent and hub links: the pages this page sits under (locality hub, service or dish page, city hub, guide). */
export const MAX_PARENT_LINKS = 3;

/** The same page in the nearest localities. */
export const MAX_NEARBY_LINKS = 6;

/** Sibling and child pages: other services, dishes or intents on the same scope, and the pages under a hub. */
export const MAX_RELATED_LINKS = 8;

export const LINK_CAPS = Object.freeze({
  parent: MAX_PARENT_LINKS,
  nearby: MAX_NEARBY_LINKS,
  related: MAX_RELATED_LINKS,
});

export type LinkGroup = keyof typeof LINK_CAPS;

/** In reading order. Each has a heading in the English messages: `links.heading.{group}`. */
export const LINK_GROUPS: readonly LinkGroup[] = Object.freeze(['parent', 'nearby', 'related'] as const);
