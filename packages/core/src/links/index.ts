// @mm/core/links (owner C05b): the internal link engine and the slug-collision checker. Pure and runtime-neutral
// (Node and Cloudflare Workers): the manifest and the locality data come in as arguments.
export { LINK_CAPS, LINK_GROUPS, MAX_NEARBY_LINKS, MAX_PARENT_LINKS, MAX_RELATED_LINKS } from './caps.ts';
export type { LinkGroup } from './caps.ts';
export { createLinkEngine, relatedLinks } from './engine.ts';
export type { LinkEngine, LinkEntry, LinkPage, RelatedLink, RelatedLinks } from './engine.ts';
export { findSlugCollisions, serviceIds } from './collisions.ts';
export type { CollisionKind, SlugCollision, SlugSets } from './collisions.ts';
