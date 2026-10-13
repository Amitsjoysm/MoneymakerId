import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { dedupeKey } from './dedupe.ts';

const PHONE = '+919876543210';

describe('dedupeKey', () => {
  it('is the sha256 hex of a fixed, versioned preimage (regression vector)', async () => {
    expect(await dedupeKey(PHONE, 'terrace-waterproofing')).toBe(
      '190adb2b71bf7405c8ece62b03e86df467be97bf7a78dbfac0aefbd0bdb708bd',
    );
    // The same value, computed independently with node:crypto.
    const preimage = `mm:lead-dedupe:v1\n${PHONE}\nterrace-waterproofing`;
    expect(await dedupeKey(PHONE, 'terrace-waterproofing')).toBe(
      createHash('sha256').update(preimage).digest('hex'),
    );
  });

  it('is stable across calls', async () => {
    expect(await dedupeKey(PHONE, 'painting')).toBe(await dedupeKey(PHONE, 'painting'));
  });

  it('differs per phone and per service: the same phone for two services is two leads', async () => {
    const keys = new Set([
      await dedupeKey(PHONE, 'painting'),
      await dedupeKey(PHONE, 'waterproofing'),
      await dedupeKey('+919876543211', 'painting'),
    ]);
    expect(keys.size).toBe(3);
  });

  it('is 64 lowercase hex characters and holds no raw phone number', async () => {
    const key = await dedupeKey(PHONE, 'painting');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('9876543210');
    expect(key).not.toContain('919876543210');
  });

  it('rejects a phone that is not an E.164 Indian mobile and a service that is not a slug', async () => {
    await expect(dedupeKey('9876543210', 'painting')).rejects.toThrow(RangeError);
    await expect(dedupeKey('+442071234567', 'painting')).rejects.toThrow(RangeError);
    await expect(dedupeKey('', 'painting')).rejects.toThrow(RangeError);
    await expect(dedupeKey(PHONE, '')).rejects.toThrow(RangeError);
    await expect(dedupeKey(PHONE, '  ')).rejects.toThrow(RangeError);
    // A service id is a slug, so it can never carry the newline that separates the preimage fields.
    await expect(dedupeKey(PHONE, 'Painting')).rejects.toThrow(RangeError);
    await expect(dedupeKey(PHONE, 'painting\n+919876543211')).rejects.toThrow(RangeError);
  });

  it('property: distinct (phone, service) pairs give distinct keys, equal pairs equal keys', async () => {
    const phone = fc.stringMatching(/^[6-9]\d{9}$/).map((digits) => `+91${digits}`);
    const service = fc.constantFrom('painting', 'waterproofing', 'modular-kitchen', 'house-construction');
    await fc.assert(
      fc.asyncProperty(fc.tuple(phone, service), fc.tuple(phone, service), async ([p1, s1], [p2, s2]) => {
        const [k1, k2] = [await dedupeKey(p1, s1), await dedupeKey(p2, s2)];
        expect(k1 === k2).toBe(p1 === p2 && s1 === s2);
      }),
      { numRuns: 100 },
    );
  });
});
