import { describe, expect, it } from 'vitest';
import type { CostModel } from '../schema/index.ts';
import { makeModel } from './fixtures/models.ts';
import { selectModel } from './select.ts';

const m = (id: string, over: Partial<CostModel> = {}) => makeModel({ id, ...over });

describe('selectModel: tiers', () => {
  const models = [m('b', { tier: 'budget' }), m('s', { tier: 'standard' })];

  it('returns the only model at the tier', () => {
    expect(selectModel(models, { service_id: 'example-service', tier: 'budget' })).toEqual({
      ok: true,
      value: models[0],
    });
  });

  it('returns a typed "no data for this tier" result, never a price from another tier', () => {
    expect(selectModel(models, { service_id: 'example-service', tier: 'premium' })).toEqual({
      ok: false,
      error: {
        code: 'no_data_for_tier',
        service_id: 'example-service',
        tier: 'premium',
        available_tiers: ['budget', 'standard'],
      },
    });
  });

  it('lists available tiers in budget, standard, premium order whatever the input order', () => {
    const shuffled = [m('p', { tier: 'premium' }), m('b', { tier: 'budget' })];
    const out = selectModel(shuffled, { service_id: 'example-service', tier: 'standard' });
    expect(!out.ok && out.error.code === 'no_data_for_tier' && out.error.available_tiers).toEqual([
      'budget',
      'premium',
    ]);
  });

  it('reports a service with no models as having no data, with no available tiers', () => {
    expect(selectModel(models, { service_id: 'other-service', tier: 'standard' })).toEqual({
      ok: false,
      error: { code: 'no_data_for_tier', service_id: 'other-service', tier: 'standard', available_tiers: [] },
    });
  });
});

describe('selectModel: scope and material', () => {
  const generic = m('generic');
  const full = m('full', { scope_id: 'full-renovation' });
  const cosmetic = m('cosmetic', { scope_id: 'cosmetic-refresh' });
  const tiled = m('tiled', { scope_id: 'full-renovation', material_id: 'ceramic' });
  const stone = m('stone', { scope_id: 'full-renovation', material_id: 'stone' });
  const q = (extra: object) => ({ service_id: 'example-service', tier: 'standard' as const, ...extra });
  const id = (r: ReturnType<typeof selectModel>) => (r.ok ? r.value.id : r.error.code);

  it('matches the scope exactly', () => {
    expect(id(selectModel([generic, full, cosmetic], q({ scope_id: 'cosmetic-refresh' })))).toBe('cosmetic');
  });

  it('prefers the generic model when scope and material are left open', () => {
    expect(id(selectModel([full, generic, cosmetic], q({})))).toBe('generic');
  });

  it('treats null and a missing field the same', () => {
    expect(id(selectModel([full, generic], q({ scope_id: null, material_id: null })))).toBe('generic');
  });

  it('does not fall back to a generic model for a scope it does not name', () => {
    const out = selectModel([generic, full], q({ scope_id: 'cosmetic-refresh' }));
    expect(out).toEqual({
      ok: false,
      error: {
        code: 'no_matching_model',
        service_id: 'example-service',
        tier: 'standard',
        scope_id: 'cosmetic-refresh',
        material_id: null,
        candidate_ids: ['generic', 'full'],
      },
    });
  });

  it('asks for a material when several fit and none is generic on it', () => {
    const out = selectModel([tiled, stone], q({ scope_id: 'full-renovation' }));
    expect(out).toEqual({
      ok: false,
      error: {
        code: 'ambiguous_model',
        service_id: 'example-service',
        tier: 'standard',
        candidate_ids: ['tiled', 'stone'],
      },
    });
  });

  it('prefers the model that is generic on the dimension left open', () => {
    expect(id(selectModel([tiled, full, stone], q({ scope_id: 'full-renovation' })))).toBe('full');
  });

  it('picks the one material model when the material is chosen', () => {
    expect(
      id(selectModel([tiled, full, stone], q({ scope_id: 'full-renovation', material_id: 'stone' }))),
    ).toBe('stone');
  });

  it('returns the single model at the tier even when it is scope-specific and the scope is open', () => {
    expect(id(selectModel([cosmetic], q({})))).toBe('cosmetic');
  });

  it('is ambiguous when several scope-specific models exist and nothing was chosen', () => {
    const out = selectModel([full, cosmetic], q({}));
    expect(!out.ok && out.error).toEqual({
      code: 'ambiguous_model',
      service_id: 'example-service',
      tier: 'standard',
      candidate_ids: ['full', 'cosmetic'],
    });
  });

  it('is ambiguous, naming only the duplicates, when two generic models both fit', () => {
    const out = selectModel([m('g1'), m('g2'), full], q({}));
    expect(!out.ok && out.error.code === 'ambiguous_model' && out.error.candidate_ids).toEqual(['g1', 'g2']);
  });

  it('ignores models of other services and tiers', () => {
    const others = [m('x', { service_id: 'other' }), m('y', { tier: 'budget' }), generic];
    expect(id(selectModel(others, q({})))).toBe('generic');
  });
});
