import { describe, expect, it } from 'vitest';
import { LLM_SCHEMAS, LlmClaimSchema, LlmEntitySchema, LlmExtractionSchema, exportLlmJsonSchemas } from './llm.ts';
import { strictSchemaViolations, toStrictJsonSchema } from './json-schema.ts';
import { z } from 'zod';

describe('LLM-facing schemas', () => {
  it('parse a nullable-complete payload', () => {
    const claim = {
      claim_type: 'price',
      supporting_quote: 'Chicken biryani Rs. 249',
      dish_id: 'biryani',
      variant_label: 'Chicken biryani',
      service_id: null,
      price_inr: 249,
      price_unit: 'serving',
      rating_value: null,
      rating_scale: null,
      sentiment: null,
      text: null,
      ends_on: null,
    };
    expect(LlmClaimSchema.safeParse(claim).success).toBe(true);
    const entity = {
      name: 'Green Leaf Cafe',
      kind: 'restaurant',
      locality_id: 'wakad',
      address: null,
      phone: null,
      website: null,
      chain_hint: null,
      branch_key: null,
      claims: [claim],
    };
    expect(LlmEntitySchema.safeParse(entity).success).toBe(true);
    expect(LlmExtractionSchema.safeParse({ entities: [entity] }).success).toBe(true);
  });

  it('require every property: a missing nullable field is an error, not a default', () => {
    const { price_inr: _p, ...missing } = {
      claim_type: 'price',
      supporting_quote: 'q',
      dish_id: null,
      variant_label: null,
      service_id: null,
      price_inr: null,
      price_unit: null,
      rating_value: null,
      rating_scale: null,
      sentiment: null,
      text: null,
      ends_on: null,
    };
    expect(LlmClaimSchema.safeParse(missing).success).toBe(false);
  });

  it('never let the model emit locality_fact or cost_rate claims, which are curated', () => {
    const options = LlmClaimSchema.shape.claim_type.options as string[];
    expect(options).not.toContain('locality_fact');
    expect(options).not.toContain('cost_rate');
  });
});

describe('exported JSON schemas satisfy Groq strict mode', () => {
  const exported = exportLlmJsonSchemas();

  it('exports one schema per registered LLM schema', () => {
    expect(Object.keys(exported).sort()).toEqual(Object.keys(LLM_SCHEMAS).sort());
    expect(Object.keys(exported).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(exported))('%s: every property required, optional means nullable, no extra properties', (_name, json) => {
    expect(strictSchemaViolations(json)).toEqual([]);
  });

  it('has no $schema header and uses only strict-mode keywords', () => {
    for (const json of Object.values(exported)) {
      expect('$schema' in json).toBe(false);
      const keywords = new Set<string>();
      const walk = (n: unknown) => {
        if (Array.isArray(n)) n.forEach(walk);
        else if (n && typeof n === 'object') {
          for (const [k, v] of Object.entries(n)) {
            if (k !== 'properties') keywords.add(k);
            if (k === 'properties') Object.values(v as object).forEach(walk);
            else walk(v);
          }
        }
      };
      walk(json);
      const allowed = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'description', 'anyOf']);
      expect([...keywords].filter((k) => !allowed.has(k))).toEqual([]);
    }
  });

  it('nullable fields export as a type union including null', () => {
    const claim = exported['LlmClaim'] as { properties: Record<string, { type?: unknown }> };
    expect(claim.properties['price_inr']!.type).toEqual(['number', 'null']);
    expect(claim.properties['supporting_quote']!.type).toBe('string');
  });
});

describe('strictSchemaViolations (the checker itself)', () => {
  it('flags an optional property, a missing additionalProperties:false and a non-nullable optional', () => {
    const schema = toStrictJsonSchema(z.object({ a: z.string(), b: z.string().optional() }));
    const violations = strictSchemaViolations(schema);
    expect(violations.some((v) => /b/.test(v) && /required/.test(v))).toBe(true);
  });
  it('flags loose objects', () => {
    const loose = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] };
    expect(strictSchemaViolations(loose).some((v) => /additionalProperties/.test(v))).toBe(true);
  });
  it('recurses into arrays and nested objects', () => {
    const nested = {
      type: 'object',
      properties: { list: { type: 'array', items: { type: 'object', properties: { x: { type: 'string' } }, required: [], additionalProperties: false } } },
      required: ['list'],
      additionalProperties: false,
    };
    expect(strictSchemaViolations(nested).some((v) => /list/.test(v) && /x/.test(v))).toBe(true);
  });
  it('accepts a fully strict schema', () => {
    expect(strictSchemaViolations(toStrictJsonSchema(z.object({ a: z.string().nullable(), b: z.array(z.object({ c: z.number() })) })))).toEqual([]);
  });
});
