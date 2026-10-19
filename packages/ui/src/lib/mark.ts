// The MarketMind AI mark: a ribbon bookmark carrying one evidence node, in the TechResona magenta-to-signal
// sweep. It is the only place in the system a gradient is allowed (the owner's rule: no gradients, glass,
// glow or 3D anywhere except the brand mark). Shared by the Wordmark component and the favicon.

export const MARK_VIEWBOX = '0 0 24 32';

/** The bookmark: square top with soft corners, swallowtail notch at the foot. */
export const MARK_RIBBON = 'M4 1.5h16A2.5 2.5 0 0 1 22.5 4v26.2L12 23.4 1.5 30.2V4A2.5 2.5 0 0 1 4 1.5z';

/** The evidence node riding on the ribbon. */
export const MARK_NODE = { cx: 12, cy: 11.5, r: 4.25 } as const;

export const MARK_FROM = '#A6237F';
export const MARK_TO = '#E0435F';

/** Self-contained SVG for the favicon (a data URI: no extra request, no file outside this package). */
export function markSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${MARK_FROM}"/><stop offset="1" stop-color="${MARK_TO}"/></linearGradient></defs>` +
    `<path d="${MARK_RIBBON}" fill="url(#g)"/>` +
    `<circle cx="${MARK_NODE.cx}" cy="${MARK_NODE.cy}" r="${MARK_NODE.r}" fill="none" stroke="#fff" stroke-width="2.4"/>` +
    `</svg>`
  );
}

export function markDataUri(): string {
  return `data:image/svg+xml,${encodeURIComponent(markSvg())}`;
}
