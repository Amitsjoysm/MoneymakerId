// Every foreground/background combination the components draw, with the WCAG 2.2 minimum it must meet.
// `text` pairs need 4.5:1 (1.4.3); `ui` pairs (control boundaries, focus rings, ribbon lines, nodes, icons,
// the stale strike) need 3:1 (1.4.11). The contrast test checks each pair in every theme, mode and vertical.
// A component that puts a token on a new background adds the pair here first.

export type PairKind = 'text' | 'ui';

export interface TokenPair {
  fg: string;
  bg: string;
  kind: PairKind;
}

export const MIN_CONTRAST: Readonly<Record<PairKind, number>> = { text: 4.5, ui: 3 };

/** The three grounds every component can sit on. */
export const GROUNDS = ['--mm-ground', '--mm-surface', '--mm-raised'] as const;

const onEveryGround = (fg: string, kind: PairKind): TokenPair[] => GROUNDS.map((bg) => ({ fg, bg, kind }));

export const TOKEN_PAIRS: readonly TokenPair[] = [
  // Reading column, secondary text, links and the ribbon's own labels.
  ...onEveryGround('--mm-ink', 'text'),
  ...onEveryGround('--mm-ink-2', 'text'),
  ...onEveryGround('--mm-ribbon', 'text'),
  // Stale facts: the label text, and the strike line and ring.
  ...onEveryGround('--mm-signal-ink', 'text'),
  ...onEveryGround('--mm-signal', 'ui'),
  // Locality and place markers (vertical accent): label text and the marker itself.
  ...onEveryGround('--mm-place-ink', 'text'),
  ...onEveryGround('--mm-place', 'ui'),
  // Control boundaries, the dashed estimate line, focus rings.
  ...onEveryGround('--mm-line-strong', 'ui'),
  ...onEveryGround('--mm-faint', 'ui'),
  ...onEveryGround('--mm-focus', 'ui'),
  // Primary action: label on the ribbon fill, at rest and on hover; the fill against the page.
  { fg: '--mm-on-ribbon', bg: '--mm-ribbon', kind: 'text' },
  { fg: '--mm-on-ribbon', bg: '--mm-ribbon-deep', kind: 'text' },
  ...onEveryGround('--mm-ribbon-deep', 'text'),
  // Selected chip: wash fill with ink and ribbon text, ringed by the ribbon.
  { fg: '--mm-ink', bg: '--mm-ribbon-wash', kind: 'text' },
  { fg: '--mm-ribbon-deep', bg: '--mm-ribbon-wash', kind: 'text' },
  { fg: '--mm-ribbon', bg: '--mm-ribbon-wash', kind: 'ui' },
  // Text selection.
  { fg: '--mm-ink', bg: '--mm-select', kind: 'text' },
];

/** Every colour token the theme must define, in every context. */
export const COLOR_TOKENS: readonly string[] = [
  ...new Set([...TOKEN_PAIRS.flatMap((p) => [p.fg, p.bg]), '--mm-line']),
].sort();
