import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToOklch, oklchToSrgb, parseOklch, relativeLuminance, srgbToHex } from './color.ts';

describe('parseOklch', () => {
  it('reads lightness as a fraction or a percentage, chroma and hue', () => {
    expect(parseOklch('oklch(0.5 0.1 200)')).toEqual({ l: 0.5, c: 0.1, h: 200 });
    expect(parseOklch('oklch(62.5% 0.2 30deg)')).toEqual({ l: 0.625, c: 0.2, h: 30 });
  });

  it('rejects anything that is not a plain oklch() value', () => {
    expect(() => parseOklch('#ffffff')).toThrow(/oklch/);
    expect(() => parseOklch('oklch(0.5 0.1)')).toThrow(/oklch/);
    expect(() => parseOklch('oklch(0.5 0.1 200 / 50%)')).toThrow(/alpha/);
  });
});

describe('oklchToSrgb', () => {
  it('maps the OKLab reference points to sRGB white, black and red', () => {
    expect(srgbToHex(oklchToSrgb({ l: 1, c: 0, h: 0 }).rgb)).toBe('#ffffff');
    expect(srgbToHex(oklchToSrgb({ l: 0, c: 0, h: 0 }).rgb)).toBe('#000000');
    // CSS Color 4 sample: oklch(62.8% 0.2577 29.23) is sRGB red.
    expect(srgbToHex(oklchToSrgb({ l: 0.628, c: 0.2577, h: 29.23 }).rgb)).toBe('#ff0000');
  });

  it('flags colours outside the sRGB gamut instead of hiding the clip', () => {
    expect(oklchToSrgb({ l: 0.7, c: 0.4, h: 150 }).inGamut).toBe(false);
    expect(oklchToSrgb({ l: 0.5, c: 0.05, h: 330 }).inGamut).toBe(true);
  });
});

describe('hexToOklch', () => {
  it('round-trips the TechResona palette through OKLCH', () => {
    for (const hex of ['#2a1130', '#6e4a72', '#9c7ca0', '#faf6fa', '#f3e9f4', '#d9c0de', '#a6237f', '#e0435f']) {
      expect(srgbToHex(oklchToSrgb(hexToOklch(hex)).rgb)).toBe(hex);
    }
  });
});

describe('contrast', () => {
  it('follows the WCAG 2 relative luminance formula', () => {
    expect(relativeLuminance({ r: 1, g: 1, b: 1 })).toBeCloseTo(1, 6);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it('gives 21:1 for black on white and is symmetric', () => {
    const white = { r: 1, g: 1, b: 1 };
    const black = { r: 0, g: 0, b: 0 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 6);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 6);
  });

  it('matches a known mid-grey value (#767676 on white is 4.54:1)', () => {
    const grey = 0x76 / 255;
    expect(contrastRatio({ r: grey, g: grey, b: grey }, { r: 1, g: 1, b: 1 })).toBeCloseTo(4.54, 2);
  });
});
