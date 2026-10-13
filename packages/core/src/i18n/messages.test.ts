import { describe, expect, it } from 'vitest';
import {
  AreaPresetSchema,
  CostUnitSchema,
  LocaleSchema,
  OwnershipSchema,
  PropertyTypeSchema,
  TierSchema,
  TimelineSchema,
} from '../schema/index.ts';
import { EN_MESSAGES, MESSAGE_KEYS, isMessageKey, message } from './messages.ts';

const KEY_SHAPE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;
const PLACEHOLDER = /\{([^{}]*)\}/g;

describe('en messages: shape', () => {
  it('has a substantial catalogue', () => {
    expect(MESSAGE_KEYS.length).toBeGreaterThan(80);
  });

  it('lists exactly the keys of the catalogue', () => {
    expect([...MESSAGE_KEYS].sort()).toEqual(Object.keys(EN_MESSAGES).sort());
  });

  it('uses flat dotted lowercase keys', () => {
    for (const key of MESSAGE_KEYS) expect(key, key).toMatch(KEY_SHAPE);
  });

  it('never lets one key be a dotted prefix of another (the keys must stay flat)', () => {
    for (const a of MESSAGE_KEYS) {
      for (const b of MESSAGE_KEYS) {
        expect(b.startsWith(`${a}.`), `${a} is a prefix of ${b}`).toBe(false);
      }
    }
  });

  it('has non-empty, trimmed, single-line string values', () => {
    for (const key of MESSAGE_KEYS) {
      const value = EN_MESSAGES[key];
      expect(typeof value, key).toBe('string');
      expect(value.length, key).toBeGreaterThan(0);
      expect(value, key).toBe(value.trim());
      expect(value, key).not.toMatch(/[\n\r\t]/);
    }
  });

  it('uses only {snake_case} placeholders', () => {
    for (const key of MESSAGE_KEYS) {
      for (const [, name] of EN_MESSAGES[key].matchAll(PLACEHOLDER)) {
        expect(name, `${key}: placeholder "${name}"`).toMatch(/^[a-z][a-z0-9_]*$/);
      }
      expect(EN_MESSAGES[key].replace(PLACEHOLDER, ''), `${key}: stray brace`).not.toMatch(/[{}]/);
    }
  });

  it('carries no phone number and no link (those come from data and constants, never from UI strings)', () => {
    for (const key of MESSAGE_KEYS) {
      expect(EN_MESSAGES[key], key).not.toMatch(/919834346179|9834346179/);
      expect(EN_MESSAGES[key], key).not.toMatch(/https?:\/\//i);
    }
  });
});

describe('en messages: the groups the components and pages share', () => {
  const prefixes = ['nav', 'cta', 'form', 'error', 'empty', 'common', 'feedback', 'links', 'locale'];
  it.each(prefixes)('has %s.* strings', (prefix) => {
    expect(MESSAGE_KEYS.some((k) => k.startsWith(`${prefix}.`))).toBe(true);
  });

  it('has the CTA the brief names', () => {
    expect(isMessageKey('cta.get_quotes')).toBe(true);
    expect(EN_MESSAGES['cta.get_quotes']).toBe('Get quotes');
  });

  it('names every locale in its own language', () => {
    for (const locale of LocaleSchema.options) expect(isMessageKey(`locale.${locale}`), locale).toBe(true);
  });

  it.each([
    ['property_type', PropertyTypeSchema.options],
    ['ownership', OwnershipSchema.options],
    ['timeline', TimelineSchema.options],
    ['tier', TierSchema.options],
    ['area_preset', AreaPresetSchema.options],
    ['cost_unit', CostUnitSchema.options],
  ] as const)('has a label for every %s option, so a new enum value fails here first', (group, options) => {
    for (const option of options) expect(isMessageKey(`${group}.${option}`), `${group}.${option}`).toBe(true);
  });

  it('has no label for an option the schema does not have', () => {
    const groups: Record<string, readonly string[]> = {
      property_type: PropertyTypeSchema.options,
      ownership: OwnershipSchema.options,
      timeline: TimelineSchema.options,
      tier: TierSchema.options,
      area_preset: AreaPresetSchema.options,
      cost_unit: CostUnitSchema.options,
    };
    for (const key of MESSAGE_KEYS) {
      const [group, option] = [key.slice(0, key.indexOf('.')), key.slice(key.indexOf('.') + 1)];
      if (group in groups) expect(groups[group], key).toContain(option);
    }
  });
});

describe('isMessageKey', () => {
  it('is true for catalogue keys and false for anything else', () => {
    expect(isMessageKey('nav.home')).toBe(true);
    expect(isMessageKey('nav.nope')).toBe(false);
    expect(isMessageKey('')).toBe(false);
    expect(isMessageKey('toString')).toBe(false);
    expect(isMessageKey('__proto__')).toBe(false);
  });
});

describe('message()', () => {
  it('returns the English text for a key without placeholders', () => {
    expect(message('nav.home')).toBe(EN_MESSAGES['nav.home']);
  });

  it('fills placeholders from the parameters', () => {
    expect(message('error.required', { field: 'Phone' })).toBe('Phone is required');
    expect(message('error.too_long', { field: 'Name', max: 80 })).toBe('Name must be at most 80 characters');
  });

  it('ignores parameters the text does not use', () => {
    expect(message('nav.home', { unused: 'x' })).toBe(EN_MESSAGES['nav.home']);
  });

  it('throws, naming the key and the parameter, when a placeholder has no value', () => {
    expect(() => message('error.required')).toThrow(/error\.required.*field/s);
    expect(() => message('error.too_long', { field: 'Name' })).toThrow(RangeError);
  });

  it('does not treat inherited object properties as parameters', () => {
    expect(() => message('error.required', {} as Record<string, string>)).toThrow(RangeError);
  });

  it('inserts values literally: no replacement patterns, no second expansion', () => {
    expect(message('error.required', { field: '$&{field}$1' })).toBe('$&{field}$1 is required');
  });

  it('fills every placeholder of every message when given values for all of them', () => {
    for (const key of MESSAGE_KEYS) {
      const params: Record<string, string> = {};
      for (const [, name] of EN_MESSAGES[key].matchAll(PLACEHOLDER)) params[name!] = 'X';
      expect(message(key, params), key).not.toMatch(/[{}]/);
    }
  });
});
