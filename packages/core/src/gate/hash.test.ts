import { describe, expect, it } from 'vitest';
import { canonicalJson, contentHash, sha256Hex } from './hash.ts';

describe('canonicalJson', () => {
  it('sorts object keys recursively and writes no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}',
    );
  });

  it('is independent of key insertion order', () => {
    expect(canonicalJson({ one: 1, two: 2, three: { x: 1, y: 2 } })).toBe(
      canonicalJson({ three: { y: 2, x: 1 }, two: 2, one: 1 }),
    );
  });

  it('keeps array order, because order is content', () => {
    expect(canonicalJson([1, 2, 3])).not.toBe(canonicalJson([3, 2, 1]));
  });

  it('drops undefined object members like JSON.stringify and writes undefined array members as null', () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalJson([undefined, 1])).toBe('[null,1]');
  });

  it('writes null, booleans, strings with escapes and negative zero as JSON does', () => {
    expect(canonicalJson({ n: null, t: true, s: 'a"b\n', z: -0 })).toBe(
      '{"n":null,"s":"a\\"b\\n","t":true,"z":0}',
    );
  });

  it('uses toJSON, so a Date hashes as its ISO string', () => {
    expect(canonicalJson({ at: new Date('2026-10-12T00:00:00.000Z') })).toBe(
      '{"at":"2026-10-12T00:00:00.000Z"}',
    );
  });

  it('rejects values that have no JSON form instead of colliding them', () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/finite/);
    expect(() => canonicalJson({ n: Number.POSITIVE_INFINITY })).toThrow(/finite/);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(/function/);
    expect(() => canonicalJson({ b: 1n })).toThrow(/bigint/);
  });

  it('rejects a cycle', () => {
    const a: Record<string, unknown> = {};
    a['self'] = a;
    expect(() => canonicalJson(a)).toThrow(/cycle/);
  });

  it('treats undefined at the top level as null', () => {
    expect(canonicalJson(undefined)).toBe('null');
  });
});

describe('sha256Hex', () => {
  it('matches the published SHA-256 test vectors', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes the UTF-8 bytes of non-ASCII text', async () => {
    expect(await sha256Hex('हिंजवडी')).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex('हिंजवडी')).not.toBe(await sha256Hex('hinjewadi'));
  });
});

describe('contentHash', () => {
  it('gives identical inputs an identical hash, whatever the key order', async () => {
    const a = await contentHash({ id: 'x', rows: [{ b: 2, a: 1 }] });
    const b = await contentHash({ rows: [{ a: 1, b: 2 }], id: 'x' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when any value changes', async () => {
    expect(await contentHash({ price: 100 })).not.toBe(await contentHash({ price: 101 }));
  });
});
