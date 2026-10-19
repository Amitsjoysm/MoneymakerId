// Colour math for the token tests: OKLCH <-> sRGB (Björn Ottosson's OKLab matrices, as in CSS Color 4) and
// WCAG 2 contrast. Pure functions on numbers; nothing here runs in a page.

export interface Oklch {
  /** Lightness, 0-1. */
  l: number;
  /** Chroma, 0 and up (about 0.37 is the edge of sRGB). */
  c: number;
  /** Hue angle in degrees. */
  h: number;
}

/** sRGB channels, gamma-encoded, 0-1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const OKLCH_VALUE = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/;

/** Parses a plain `oklch(L C H)` value. Alpha is refused: a translucent token has no fixed contrast. */
export function parseOklch(value: string): Oklch {
  const text = value.trim();
  if (text.includes('/')) throw new Error(`oklch value with alpha has no fixed contrast: ${value}`);
  const match = OKLCH_VALUE.exec(text);
  if (!match) throw new Error(`not a plain oklch(L C H) value: ${value}`);
  const [, l = '', percent, c = '', h = ''] = match;
  return { l: percent ? Number(l) / 100 : Number(l), c: Number(c), h: Number(h) };
}

const GAMUT_EPSILON = 1e-4;

function encode(linear: number): number {
  const sign = linear < 0 ? -1 : 1;
  const x = Math.abs(linear);
  return sign * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
}

function decode(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Converts to gamma-encoded sRGB. `rgb` is clamped to 0-1; `inGamut` says whether clamping was needed, so a
 * token that only exists in a wider gamut fails its test instead of being measured as a different colour.
 */
export function oklchToSrgb({ l, c, h }: Oklch): { rgb: Rgb; inGamut: boolean } {
  const hue = (h * Math.PI) / 180;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);

  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp,
    -1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp,
    -0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp,
  ];
  const encoded = linear.map(encode) as [number, number, number];
  const inGamut = encoded.every((x) => x >= -GAMUT_EPSILON && x <= 1 + GAMUT_EPSILON);
  const [r, g, bl] = encoded.map(clamp01) as [number, number, number];
  return { rgb: { r, g, b: bl }, inGamut };
}

/** `#rrggbb` to OKLCH, unrounded. Used to author tokens from the TechResona hex palette. */
export function hexToOklch(hex: string): Oklch {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = match.slice(1).map((pair) => decode(parseInt(pair, 16) / 255)) as [number, number, number];

  const lp = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mp = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sp = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * lp + 0.793617785 * mp - 0.0040720468 * sp;
  const A = 1.9779984951 * lp - 2.428592205 * mp + 0.4505937099 * sp;
  const B = 0.0259040371 * lp + 0.7827717662 * mp - 0.808675766 * sp;
  const c = Math.hypot(A, B);
  const h = c < 1e-7 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

export function srgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG 2 relative luminance of a gamma-encoded sRGB colour. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

/** WCAG 2 contrast ratio, 1-21, in either order. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
