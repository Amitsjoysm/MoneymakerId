// Test fixtures for the cost engine. Every name and number here is invented for tests; none of it is data.
// Real cost models are read from data/cost-models/ by real-data.test.ts.
import type { CostModel } from '../../schema/index.ts';
import type { AreaPresetEntry, ServicePresets } from '../types.ts';

const SOURCES: CostModel['sources'] = [
  {
    url: 'https://example.com/rates',
    title: 'Example rate card',
    publisher: 'Example Publisher A',
    retrieved_at: '2026-10-01',
    quote: null,
  },
  {
    url: 'https://example.org/rates',
    title: 'Example price list',
    publisher: 'Example Publisher B',
    retrieved_at: '2026-10-02',
    quote: null,
  },
];

const FACTOR_SOURCES: CostModel['sources'] = [
  {
    url: 'https://example.net/pune-factor',
    title: 'Example locality note',
    publisher: 'Example Publisher C',
    retrieved_at: '2026-10-03',
    quote: null,
  },
];

export function makeModel(overrides: Partial<CostModel> = {}): CostModel {
  return {
    id: 'example-model',
    service_id: 'example-service',
    scope_id: null,
    material_id: null,
    tier: 'standard',
    unit: 'sqft',
    rate_inr: { low: 40, expected: 60, high: 90 },
    min_job_inr: null,
    components: {
      materials: 0.35,
      labour: 0.35,
      preparation: 0.15,
      repair: 0.08,
      transport: 0.03,
      waste: 0.04,
    },
    locality_factors: [],
    sources: SOURCES.map((s) => ({ ...s })),
    reviewed_at: '2026-10-06',
    valid_until: '2027-04-04',
    status: 'draft',
    notes: 'Example model for tests.',
    ...overrides,
  };
}

export function localityFactor(locality_id: string, factor: number): CostModel['locality_factors'][number] {
  return { locality_id, factor, sources: FACTOR_SOURCES.map((s) => ({ ...s })) };
}

export const EXAMPLE_PRESETS: readonly AreaPresetEntry[] = [
  {
    preset: '1bhk',
    label: '1 BHK flat',
    quantity: 800,
    assumption: 'Example assumption: 800 sq ft.',
    sources: SOURCES.map((s) => ({ ...s })),
  },
  {
    preset: '2bhk',
    label: '2 BHK flat',
    quantity: 1_200,
    assumption: 'Example assumption: 1,200 sq ft.',
    sources: SOURCES.map((s) => ({ ...s })),
  },
];

export function makeService(overrides: Partial<ServicePresets> = {}): ServicePresets {
  return { unit: 'sqft', area_presets: EXAMPLE_PRESETS, ...overrides };
}
