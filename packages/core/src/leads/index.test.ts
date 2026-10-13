import { describe, expect, it } from 'vitest';
import * as constants from '../constants/index.ts';
import * as leads from './index.ts';

describe('@mm/core/leads public surface', () => {
  it('exports the lead logic named on the C06 card', () => {
    expect(Object.keys(leads).sort()).toEqual([
      'LEAD_CONSENT_V1',
      'REMINDER_CONSENT_V1',
      'SERVICE_REF_ABBR',
      'WHATSAPP_NUMBER',
      'ctaCopy',
      'dedupeKey',
      'leadScore',
      'normalisePhone',
      'refCode',
      'whatsappUrl',
    ]);
  });

  it('re-exports the consent constants from /constants rather than copying them', () => {
    expect(leads.LEAD_CONSENT_V1).toBe(constants.LEAD_CONSENT_V1);
    expect(leads.REMINDER_CONSENT_V1).toBe(constants.REMINDER_CONSENT_V1);
  });
});

describe('acceptance: the C06 card', () => {
  it('"3 quotes" never appears with fewer than 3 accepting providers', () => {
    for (let acceptingProviders = 0; acceptingProviders <= 10; acceptingProviders += 1) {
      const copy = leads.ctaCopy({ acceptingProviders, service: 'waterproofing', locality: 'Wakad' });
      const text = `${copy.label} ${copy.description} ${copy.microcopy}`;
      expect(
        /\b(3|three)\b.*quotes?|quotes?.*\b(3|three)\b/i.test(text),
        `${acceptingProviders}: ${text}`,
      ).toBe(acceptingProviders >= 3);
    }
  });

  it('the WhatsApp link is the exact wa.me URL for MarketMind AI, with the ref code', () => {
    const ref = leads.refCode({ localityId: 'wakad', serviceId: 'waterproofing' });
    expect(ref).toBe('C-WAKAD-WP');
    expect(leads.whatsappUrl({ text: 'Hi, I need a quote.', ref })).toBe(
      'https://wa.me/919834346179?text=Hi%2C%20I%20need%20a%20quote.%0A%0ARef%20C-WAKAD-WP',
    );
  });

  it('a phone typed any accepted way scores and dedupes under one E.164 number', async () => {
    const phone = leads.normalisePhone('+91 98765-43210');
    expect(phone).toBe('+919876543210');
    expect(await leads.dedupeKey(phone as string, 'waterproofing')).toBe(
      await leads.dedupeKey(leads.normalisePhone('09876543210') as string, 'waterproofing'),
    );
  });
});
