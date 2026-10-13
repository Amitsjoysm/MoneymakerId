import { describe, expect, it } from 'vitest';
import { EXAMPLE_PRESETS, makeService } from './fixtures/models.ts';
import { resolveQuantity } from './quantity.ts';

describe('resolveQuantity: explicit quantity', () => {
  it('uses the quantity of a custom area as given, fractions included', () => {
    const out = resolveQuantity({ preset: 'custom', quantity: 1_250.5 }, null);
    expect(out).toEqual({ ok: true, value: { quantity: 1_250.5, source: 'explicit', preset: null } });
  });

  it('needs no service for a custom area', () => {
    expect(resolveQuantity({ preset: 'custom', quantity: 10 }, undefined).ok).toBe(true);
  });

  it.each([null, undefined])('returns a typed error when a custom area has quantity %s', (quantity) => {
    expect(resolveQuantity({ preset: 'custom', quantity }, makeService())).toEqual({
      ok: false,
      error: { code: 'invalid_quantity', reason: 'missing' },
    });
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('rejects a custom quantity of %s', (quantity) => {
    expect(resolveQuantity({ preset: 'custom', quantity }, null)).toEqual({
      ok: false,
      error: { code: 'invalid_quantity', reason: 'not_positive_finite' },
    });
  });
});

describe('resolveQuantity: presets', () => {
  it('resolves a preset through the service presets and returns the entry with its assumption', () => {
    const out = resolveQuantity({ preset: '2bhk' }, makeService());
    expect(out).toEqual({
      ok: true,
      value: { quantity: 1_200, source: 'preset', preset: EXAMPLE_PRESETS[1] },
    });
  });

  it('returns a copy of the preset entry, not the service object itself', () => {
    const out = resolveQuantity({ preset: '1bhk' }, makeService());
    expect(out.ok && out.value.preset).toEqual(EXAMPLE_PRESETS[0]);
    expect(out.ok && out.value.preset).not.toBe(EXAMPLE_PRESETS[0]);
    expect(out.ok && out.value.preset?.sources).not.toBe(EXAMPLE_PRESETS[0]!.sources);
  });

  it('lets the preset win over a stale quantity on a non-custom area', () => {
    const out = resolveQuantity({ preset: '1bhk', quantity: 99_999 }, makeService());
    expect(out.ok && out.value.quantity).toBe(800);
  });

  it('returns a typed error, not a guess, when the service has no presets at all', () => {
    expect(resolveQuantity({ preset: '2bhk' }, makeService({ area_presets: [] }))).toEqual({
      ok: false,
      error: { code: 'preset_unavailable', preset: '2bhk', available_presets: [] },
    });
  });

  it('returns a typed error naming the presets that do exist', () => {
    expect(resolveQuantity({ preset: 'terrace' }, makeService())).toEqual({
      ok: false,
      error: { code: 'preset_unavailable', preset: 'terrace', available_presets: ['1bhk', '2bhk'] },
    });
  });

  it('treats a missing service as having no presets', () => {
    expect(resolveQuantity({ preset: '1bhk' }, null)).toEqual({
      ok: false,
      error: { code: 'preset_unavailable', preset: '1bhk', available_presets: [] },
    });
  });
});
