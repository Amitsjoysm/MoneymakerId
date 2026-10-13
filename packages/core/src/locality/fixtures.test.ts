import { describe, expect, it } from 'vitest';
import { ALL_SERVICE_IDS, DISH_IDS, LOCALITY_IDS, SUB_LOCALITY_IDS } from '../constants/index.ts';
import { DishSchema, LocalitySchema, TopLevelServiceSchema } from '../schema/index.ts';
import type { ServiceDef } from '../schema/index.ts';
import { DISHES, LOCALITIES, SERVICES, SERVICE_ALIASES } from './fixtures.ts';

function flat(s: ServiceDef): string[] {
  return [s.id, ...s.sub_services.flatMap(flat)];
}

describe('fixtures', () => {
  it('hold every CONTRACTS §4a locality, sub-locality and at least two landmarks, and all validate', () => {
    const ids = LOCALITIES.map((l) => l.id);
    for (const id of [...LOCALITY_IDS, ...SUB_LOCALITY_IDS]) expect(ids).toContain(id);
    expect(LOCALITIES.filter((l) => l.kind === 'landmark').length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LOCALITIES) expect(() => LocalitySchema.parse(l), l.id).not.toThrow();
  });

  it('hold the 16 parent dishes, and all validate', () => {
    expect(DISHES.map((d) => d.id)).toEqual([...DISH_IDS]);
    for (const d of DISHES) expect(() => DishSchema.parse(d), d.id).not.toThrow();
  });

  it('hold the 12 service ids across 5 top-level services, and all validate', () => {
    expect(SERVICES).toHaveLength(5);
    expect(SERVICES.flatMap(flat).sort()).toEqual([...ALL_SERVICE_IDS].sort());
    for (const s of SERVICES) expect(() => TopLevelServiceSchema.parse(s), s.id).not.toThrow();
  });

  it('give aliases only to known service ids', () => {
    const all = new Set(SERVICES.flatMap(flat));
    for (const id of Object.keys(SERVICE_ALIASES)) expect(all.has(id), id).toBe(true);
  });
});
