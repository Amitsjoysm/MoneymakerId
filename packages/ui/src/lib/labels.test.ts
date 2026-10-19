import { BadgeLabelSchema, TempLabelSchema, TrustLabelSchema } from '@mm/core/schema';
import { describe, expect, it } from 'vitest';
import { labelText, TRUST_TEXT } from './labels.ts';
import { uid } from './uid.ts';

describe('label texts', () => {
  it('names every temperature and badge label of the contract (CONTRACTS §3)', () => {
    for (const label of [...TempLabelSchema.options, ...BadgeLabelSchema.options]) {
      expect(labelText(label), label).toMatch(/^[A-Z][a-z -]+$/);
    }
    expect(labelText('hidden_gem')).toBe('Hidden gem');
  });

  it('names every trust label of the contract', () => {
    for (const label of TrustLabelSchema.options) expect(TRUST_TEXT[label], label).toMatch(/^[A-Z][a-z -]+$/);
    expect(TRUST_TEXT.source_backed).toBe('Source-backed');
  });
});

describe('uid', () => {
  it('gives a different id on every call, so a component rendered twice never repeats an id', () => {
    const a = uid('mm-x');
    const b = uid('mm-x');
    expect(a).toMatch(/^mm-x-\d+$/);
    expect(b).not.toBe(a);
  });
});
