// Turns the area the user chose (a preset or a quantity of their own) into the quantity the estimate multiplies.
import type { AreaInput, AreaPresetEntry, Outcome, ServicePresets } from './types.ts';

export interface ResolvedQuantity {
  quantity: number;
  source: 'preset' | 'explicit';
  /** The preset entry used, so the page can show its assumption and sources. `null` for an explicit quantity. */
  preset: AreaPresetEntry | null;
}

/**
 * `custom` takes `area.quantity`. Any other preset is looked up in `service.area_presets` and `area.quantity` is ignored.
 * A preset the service does not define (an empty list included) is a typed error; a quantity is never guessed.
 */
export function resolveQuantity(
  area: AreaInput,
  service: Pick<ServicePresets, 'area_presets'> | null | undefined,
): Outcome<ResolvedQuantity> {
  if (area.preset === 'custom') {
    const quantity = area.quantity;
    if (quantity === null || quantity === undefined) {
      return { ok: false, error: { code: 'invalid_quantity', reason: 'missing' } };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: { code: 'invalid_quantity', reason: 'not_positive_finite' } };
    }
    return { ok: true, value: { quantity, source: 'explicit', preset: null } };
  }

  const presets = service?.area_presets ?? [];
  const entry = presets.find((p) => p.preset === area.preset);
  if (!entry) {
    return {
      ok: false,
      error: {
        code: 'preset_unavailable',
        preset: area.preset,
        available_presets: presets.map((p) => p.preset),
      },
    };
  }
  // A copy, so a caller cannot change the service's presets through the result.
  const copy = { ...entry, sources: entry.sources.map((s) => ({ ...s })) };
  return { ok: true, value: { quantity: entry.quantity, source: 'preset', preset: copy } };
}
