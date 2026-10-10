import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as enums from './enums.ts';
import { findRepoRoot } from '../config/repo-root.ts';

// Drift guard: the enums are parsed straight out of CONTRACTS §3, so the contract and the code cannot disagree.
function contractEnums(): Map<string, string[]> {
  const doc = readFileSync(`${findRepoRoot()}/docs/CONTRACTS.md`, 'utf8');
  const section = doc.split(/^## 3\. Enums/m)[1]?.split(/^## 4\. /m)[0] ?? '';
  const block = /```ts\n([\s\S]*?)```/.exec(section)?.[1] ?? '';
  const lines: string[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trimEnd();
    if (/^\s+\|/.test(line) && lines.length > 0) lines[lines.length - 1] += ` ${line.trim()}`;
    else if (line.trim() !== '') lines.push(line);
  }
  const out = new Map<string, string[]>();
  for (const line of lines) {
    const m = /^(\w+)\s*=\s*(.*)$/.exec(line);
    if (!m || m[2]!.includes('`')) continue; // FoodIntent is a template literal, tested separately
    out.set(m[1]!, [...m[2]!.matchAll(/'([^']*)'/g)].map((x) => x[1]!));
  }
  return out;
}

// Closed sets named in CONTRACTS §5 to §9 (not in §3) that more than one module needs.
const EXTRA_ENUMS = [
  'ActorSchema',
  'AdProviderSchema',
  'AskVerdictSchema',
  'CampaignKindSchema',
  'EvidenceEntityTypeSchema',
  'FeedbackKindSchema',
  'KeyOutcomeKindSchema',
  'LiveStatusSchema',
  'LookupStatusSchema',
  'SentimentSchema',
  'ServedFromSchema',
  'WeekdaySchema',
];

describe('enums match CONTRACTS §3', () => {
  const contract = contractEnums();

  it('parses the contract (guards the parser itself)', () => {
    expect(contract.size).toBeGreaterThanOrEqual(40);
    expect(contract.get('Tier')).toEqual(['budget', 'standard', 'premium']);
  });

  for (const [name, values] of contractEnums()) {
    it(`${name}`, () => {
      const schema = (enums as Record<string, unknown>)[`${name}Schema`] as { options: string[] } | undefined;
      expect(schema, `${name}Schema is exported`).toBeDefined();
      expect([...schema!.options]).toEqual(values);
    });
  }

  it('exports no enum schema that is neither in §3 nor a documented extra', () => {
    const known = new Set([
      ...[...contract.keys()].map((n) => `${n}Schema`),
      'FoodIntentSchema',
      ...EXTRA_ENUMS,
    ]);
    const exported = Object.keys(enums).filter((k) => k.endsWith('Schema'));
    expect(exported.filter((k) => !known.has(k))).toEqual([]);
    expect(EXTRA_ENUMS.filter((k) => !exported.includes(k))).toEqual([]);
  });
});

describe('FoodIntent', () => {
  it.each(['under-250', 'under-100', 'veg', 'late-night', 'family', 'office-lunch'])('accepts %s', (v) => {
    expect(enums.FoodIntentSchema.safeParse(v).success).toBe(true);
  });
  it.each(['under-', 'under-2.5', 'under--5', 'under-abc', 'under-1e3', 'cheap', 'Under-250', ''])(
    'rejects %j',
    (v) => {
      expect(enums.FoodIntentSchema.safeParse(v).success).toBe(false);
    },
  );
});
