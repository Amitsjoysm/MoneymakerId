import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { strictSchemaViolations, toStrictJsonSchema } from './json-schema.ts';

describe('toStrictJsonSchema: semantics that survive the export', () => {
  it('rewrites a literal (const) as a one-value enum and keeps its type', () => {
    expect(toStrictJsonSchema(z.literal('x'))).toEqual({ type: 'string', enum: ['x'] });
  });

  it('rewrites a nullable literal as a type union with a one-value enum plus null', () => {
    expect(toStrictJsonSchema(z.literal('x').nullable())).toEqual({
      type: ['string', 'null'],
      enum: ['x', null],
    });
  });

  it('rewrites const inside object properties', () => {
    const json = toStrictJsonSchema(z.strictObject({ kind: z.literal('price') }));
    expect(json).toEqual({
      type: 'object',
      properties: { kind: { type: 'string', enum: ['price'] } },
      required: ['kind'],
      additionalProperties: false,
    });
  });

  it('collapses a nullable enum into one node', () => {
    expect(toStrictJsonSchema(z.enum(['a', 'b']).nullable())).toEqual({
      type: ['string', 'null'],
      enum: ['a', 'b', null],
    });
  });
});

describe('toStrictJsonSchema: value constraints and annotations are dropped silently', () => {
  it('drops min/max/pattern/format on strings, numbers and arrays', () => {
    const json = toStrictJsonSchema(
      z.strictObject({
        s: z.string().min(1).max(9).regex(/^a/),
        e: z.email(),
        n: z.number().int().min(0).max(10),
        x: z.number().gt(0).lt(9),
        a: z.array(z.string()).min(1).max(3),
      }),
    );
    expect(json).toEqual({
      type: 'object',
      properties: {
        s: { type: 'string' },
        e: { type: 'string' },
        n: { type: 'integer' },
        x: { type: 'number' },
        a: { type: 'array', items: { type: 'string' } },
      },
      required: ['s', 'e', 'n', 'x', 'a'],
      additionalProperties: false,
    });
  });

  it('drops $schema, title, examples and default', () => {
    const json = toStrictJsonSchema(
      z.strictObject({
        t: z.string().meta({ title: 'Title', examples: ['a'] }),
        d: z.string().default('x'),
      }),
    );
    expect(json).toEqual({
      type: 'object',
      properties: { t: { type: 'string' }, d: { type: 'string' } },
      required: ['t', 'd'],
      additionalProperties: false,
    });
  });
});

describe('toStrictJsonSchema: throws rather than drop a keyword that changes meaning', () => {
  it('throws on $ref, naming the pointer (recursive z.lazy)', () => {
    type Node = { child: Node | null };
    const Node: z.ZodType<Node> = z.strictObject({ child: z.lazy(() => Node).nullable() });
    expect(() => toStrictJsonSchema(Node)).toThrow(/\/properties\/child\/anyOf\/0.*"\$ref"/);
  });

  it('throws on $defs at the root for a reused schema registered with an id', () => {
    const Shared = z.strictObject({ x: z.string() }).meta({ id: 'Shared' });
    expect(() => toStrictJsonSchema(z.strictObject({ a: Shared, b: Shared }))).toThrow(/^#: "\$defs"/);
  });

  it('throws on allOf (z.intersection), naming the pointer', () => {
    const schema = z.strictObject({ p: z.intersection(z.string(), z.string().min(1)) });
    expect(() => toStrictJsonSchema(schema)).toThrow(/\/properties\/p.*"allOf"/);
  });

  it('throws on allOf at the root', () => {
    expect(() => toStrictJsonSchema(z.intersection(z.string(), z.string().min(1)))).toThrow(/#.*"allOf"/);
  });

  it('throws on oneOf (z.discriminatedUnion)', () => {
    const union = z.discriminatedUnion('k', [
      z.strictObject({ k: z.literal('a') }),
      z.strictObject({ k: z.literal('b') }),
    ]);
    expect(() => toStrictJsonSchema(z.strictObject({ u: union }))).toThrow(/\/properties\/u.*"oneOf"/);
  });

  it('throws on not (z.never)', () => {
    expect(() => toStrictJsonSchema(z.strictObject({ a: z.never() }))).toThrow(/\/properties\/a.*"not"/);
  });

  it('does not throw for a plain z.union of objects, which exports as anyOf', () => {
    const json = toStrictJsonSchema(
      z.union([z.strictObject({ a: z.string() }), z.strictObject({ b: z.string() })]),
    ) as { anyOf: unknown[] };
    expect(json.anyOf).toHaveLength(2);
    expect(strictSchemaViolations(json)).toEqual([]);
  });
});

describe('strictSchemaViolations flags the same keywords in a hand-written schema', () => {
  it.each(['$ref', '$defs', 'oneOf', 'allOf', 'not'])('%s', (keyword) => {
    const violations = strictSchemaViolations({ type: 'string', [keyword]: {} });
    expect(violations.some((v) => v.includes(`"${keyword}"`))).toBe(true);
  });
});
