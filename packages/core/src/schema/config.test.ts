import { describe, expect, it } from 'vitest';
import {
  AdSlotRuleSchema,
  ExperimentSchema,
  GateConfigSchema,
  GateDecisionSchema,
  GateKeySchema,
  GateResultSchema,
} from './config.ts';

const ok = (s: { safeParse(v: unknown): { success: boolean } }, v: unknown) => s.safeParse(v).success;

const rule = {
  min_entities: 3,
  min_evidence: 6,
  min_relevance: 0.6,
  min_unique: 0.5,
  seo_min: 0.5,
  requires_reviewed_prose: false,
  extra: { min_localities: 2 },
};

describe('GateKey', () => {
  it('is host:page_type', () => {
    expect(ok(GateKeySchema, 'food:dish_locality')).toBe(true);
    expect(ok(GateKeySchema, 'construction:locality_service')).toBe(true);
    expect(ok(GateKeySchema, 'food:nope')).toBe(false);
    expect(ok(GateKeySchema, 'dish_locality')).toBe(false);
    expect(ok(GateKeySchema, 'blog:home')).toBe(false);
  });
});

describe('GateConfig', () => {
  const cfg = { pages: { 'food:dish_locality': rule }, hysteresis_ratio: 0.8, noindex_grace_days: 30 };
  it('accepts the v2 GateKey shape', () => {
    expect(ok(GateConfigSchema, cfg)).toBe(true);
  });
  it('rejects the old v1 shape keyed by bare page type', () => {
    expect(ok(GateConfigSchema, { ...cfg, pages: { dish_locality: rule } })).toBe(false);
  });
  it('pins hysteresis_ratio to 0.8 and noindex_grace_days to 30', () => {
    expect(ok(GateConfigSchema, { ...cfg, hysteresis_ratio: 0.9 })).toBe(false);
    expect(ok(GateConfigSchema, { ...cfg, noindex_grace_days: 14 })).toBe(false);
  });
  it('rejects a rule with a missing field or an out-of-range threshold', () => {
    const { seo_min: _seo, ...incomplete } = rule;
    expect(ok(GateConfigSchema, { ...cfg, pages: { 'food:place': incomplete } })).toBe(false);
    expect(ok(GateConfigSchema, { ...cfg, pages: { 'food:place': { ...rule, min_relevance: 1.5 } } })).toBe(false);
  });
});

describe('GateResult and GateDecision', () => {
  const result = {
    gate_key: 'food:place',
    scores: { evidence: 4, entities: 1, relevance: 0.8, unique: 0.7, seo: 0.6 },
    passed: true,
    reasons: [],
  };
  it('accept a result and a decision', () => {
    expect(ok(GateResultSchema, result)).toBe(true);
    expect(ok(GateDecisionSchema, { action: 'build_index', result, noindex_since: null })).toBe(true);
    expect(ok(GateDecisionSchema, { action: 'redirect_parent', result, noindex_since: '2026-09-01T00:00:00Z' })).toBe(true);
  });
  it('reject an unknown action', () => {
    expect(ok(GateDecisionSchema, { action: 'publish', result, noindex_since: null })).toBe(false);
  });
});

describe('AdSlotRule and Experiment', () => {
  const adRule = {
    host: 'food',
    page_types: ['dish_locality'],
    slots: ['AD_SLOT_TOP'],
    devices: ['mobile'],
    provider: 'sponsorship',
    enabled: true,
  };
  it('AdSlotRule accepts a rule and rejects an unknown slot', () => {
    expect(ok(AdSlotRuleSchema, adRule)).toBe(true);
    expect(ok(AdSlotRuleSchema, { ...adRule, slots: ['AD_SLOT_NOPE'] })).toBe(false);
    expect(ok(AdSlotRuleSchema, { ...adRule, provider: 'facebook' })).toBe(false);
  });
  it('Experiment accepts variants with params and rejects a bad guardrail', () => {
    const exp = {
      id: 'e1',
      host: 'construction',
      page_types: ['service_cost'],
      variants: [
        { id: 'control', weight: 0.5, params: {} },
        { id: 'ads', weight: 0.5, params: { adsense: true } },
      ],
      guardrail_metric: 'quote_submit',
      active: false,
    };
    expect(ok(ExperimentSchema, exp)).toBe(true);
    expect(ok(ExperimentSchema, { ...exp, guardrail_metric: 'page_views' })).toBe(false);
    expect(ok(ExperimentSchema, { ...exp, variants: [] })).toBe(false);
  });
});
