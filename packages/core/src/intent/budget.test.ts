import { describe, expect, it } from 'vitest';
import { foldText } from '../locality/text.ts';
import { extractBudget } from './budget.ts';

const budget = (s: string) => extractBudget(foldText(s)).budget_inr;

describe('extractBudget: amounts', () => {
  it.each([
    ['under 200', 200],
    ['Under 200', 200],
    ['under ₹200', 200],
    ['under rs 200', 200],
    ['under rs. 200', 200],
    ['below 150', 150],
    ['less than 400', 400],
    ['lesser than 400', 400],
    ['upto 50', 50],
    ['up to 50', 50],
    ['within 30 rupees', 30],
    ['max 120', 120],
    ['maximum 120', 120],
    ['budget 100', 100],
    ['budget of 100', 100],
    ['around 250', 250],
    ['at most 90', 90],
    ['not more than 90', 90],
    ['<= 300', 300],
    ['< 300', 300],
    ['≤ 300', 300],
    ['₹200', 200],
    ['₹ 200', 200],
    ['rs200', 200],
    ['rs.300', 300],
    ['rs 300', 300],
    ['inr 300', 300],
    ['200 rs', 200],
    ['200rs', 200],
    ['200 rs.', 200],
    ['200 rupees', 200],
    ['200 rupaye', 200],
    ['200 ₹', 200],
    ['200/-', 200],
    ['120 /-', 120],
    ['200 ke andar', 200],
    ['200 ke ander', 200],
    ['200 ki andar', 200],
    ['200 andar', 200],
    ['250 tak', 250],
    ['100 paryant', 100],
    ['100 paryanta', 100],
    ['100 chya aat', 100],
    ['200 se kam', 200],
    ['200 se neeche', 200],
    ['under 1,000', 1000],
    ['under 1,00,000', 100000],
    ['under 1k', 1000],
    ['under 1.5k', 1500],
    ['under 50 thousand', 50000],
    ['under 50 hazar', 50000],
    ['under 2 lakh', 200000],
    ['under 2.5 lakh', 250000],
    ['under 2 lac', 200000],
    ['under २००', 200],
    ['₹२००', 200],
    ['biryani under 300 near wakad', 300],
    ['pizza 200 rs baner', 200],
  ])('%j -> %i', (text, expected) => {
    expect(budget(text)).toBe(expected);
  });

  it('takes the first amount when there are several', () => {
    expect(budget('under 200 or under 300')).toBe(200);
    expect(budget('₹300 under 200')).toBe(300);
  });
});

describe('extractBudget: numbers that are not a budget', () => {
  it.each([
    [''],
    ['biryani'],
    ['2 bhk'],
    ['3 bhk flat'],
    ['hinjewadi phase 2'],
    ['1200 sqft'],
    ['under 1200 sqft'],
    ['under 1200 sq ft'],
    ['rs 20 per sq ft'],
    ['rs 20 / sqft'],
    ['₹20 per sqft'],
    ['20 rs per sq ft'],
    ['under 0'],
    ['under 5000000000'],
    ['under'],
    ['rs'],
    ['bars 200'],
    ['300'],
    ['top 10'],
  ])('%j -> none', (text) => {
    expect(budget(text)).toBeNull();
  });

  it('does not read a longer number as a shorter one when a guard rejects it', () => {
    expect(budget('rs 20 per sq ft')).toBeNull(); // not "rs 2"
  });
});

describe('extractBudget: the rest of the text', () => {
  it('removes the amount and what points at it, and keeps everything else', () => {
    expect(extractBudget('biryani under ₹300 near wakad').rest.replace(/\s+/g, ' ').trim()).toBe(
      'biryani near wakad',
    );
    expect(extractBudget('misal 150 ke andar hinjewadi').rest.replace(/\s+/g, ' ').trim()).toBe(
      'misal hinjewadi',
    );
    expect(extractBudget('vada pav within 30 rupees').rest.replace(/\s+/g, ' ').trim()).toBe('vada pav');
  });

  it('leaves the text alone when it finds no amount', () => {
    expect(extractBudget('biryani near wakad')).toEqual({ budget_inr: null, rest: 'biryani near wakad' });
  });

  it('removes a second amount too, so stray numbers do not reach the locality matcher', () => {
    const r = extractBudget('thali under 200 and under 300');
    expect(r.budget_inr).toBe(200);
    expect(r.rest).not.toMatch(/\d/);
  });

  it('keeps the text of an amount it rejects', () => {
    expect(extractBudget('painting rs 20 per sq ft').rest).toContain('20');
  });
});
