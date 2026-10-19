import { describe, expect, it } from 'vitest';
import { leadAlert, maskPhone, renderAlert, whatsappReplyLink } from './templates.ts';
import type { AlertEvent } from './types.ts';

const PHONE = '+919876543210';

describe('maskPhone', () => {
  it('shows the first two and last three digits of an Indian mobile number', () => {
    expect(maskPhone(PHONE)).toBe('+91 98xxx xx210');
  });

  it.each(['919876543210', '9876543210', '09876543210', '+91-98765-43210', '+91 98765 43210'])(
    'masks the same number written as %j',
    (written) => {
      expect(maskPhone(written)).toBe('+91 98xxx xx210');
    },
  );

  it('masks anything else without revealing more than the last three digits', () => {
    expect(maskPhone('12345678')).toBe('xxxxx678');
    expect(maskPhone('12')).toBe('xx');
    expect(maskPhone('')).toBe('');
    expect(maskPhone('not a number')).toBe('');
  });
});

describe('renderAlert: lead', () => {
  const event: AlertEvent = {
    kind: 'lead',
    ref: 'C-WAKAD-WP',
    grade: 'A',
    lead_type: 'quote',
    service: 'waterproofing',
    locality: 'wakad',
    phone: PHONE,
  };

  it('names the ref, grade, service, locality and the masked phone', () => {
    const { subject, body } = renderAlert(event);
    expect(subject).toBe('New lead C-WAKAD-WP (grade A)');
    expect(body).toContain('Ref: C-WAKAD-WP');
    expect(body).toContain('Grade: A');
    expect(body).toContain('Type: quote');
    expect(body).toContain('Service: waterproofing');
    expect(body).toContain('Locality: wakad');
    expect(body).toContain('Phone: +91 98xxx xx210');
  });

  it('never contains the full phone number, in any common spelling', () => {
    const { subject, body } = renderAlert(event);
    for (const text of [subject, body]) {
      expect(text).not.toContain('9876543210');
      expect(text).not.toContain('98765');
      expect(text).not.toContain('43210');
      expect(text).not.toMatch(/\d{6,}/);
    }
  });

  it('says so when the service or locality is not known', () => {
    const { body } = renderAlert({ ...event, service: null, locality: undefined });
    expect(body).toContain('Service: n/a');
    expect(body).toContain('Locality: n/a');
  });

  it('keeps visitor-supplied text on one line, so it cannot add lines to the message', () => {
    const { subject, body } = renderAlert({ ...event, ref: 'C-X\nPhone: +919999999999', locality: 'a\r\nb' });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(body.split('\n').filter((l) => l.startsWith('Phone:'))).toHaveLength(1);
    expect(body).toContain('Locality: a b');
  });
});

describe('leadAlert', () => {
  const base = { ref: 'C-WAKAD-WP', grade: 'B', phone_e164: PHONE } as const;

  it('takes the service and locality from a quote lead', () => {
    const event = leadAlert({
      ...base,
      lead_type: 'quote',
      quote: { service_id: 'waterproofing', locality_id: 'wakad' },
      business: null,
    });
    expect(event).toEqual({
      kind: 'lead',
      ref: 'C-WAKAD-WP',
      grade: 'B',
      lead_type: 'quote',
      service: 'waterproofing',
      locality: 'wakad',
      phone: PHONE,
    });
  });

  it('takes the locality from the business of a featured-listing or advertising lead', () => {
    const event = leadAlert({
      ...base,
      lead_type: 'featured_enquiry',
      quote: null,
      business: { locality_id: 'baner' },
    });
    expect(event).toMatchObject({ service: null, locality: 'baner' });
  });

  it('leaves both empty for a contact lead', () => {
    const event = leadAlert({ ...base, lead_type: 'contact', quote: null, business: null });
    expect(event).toMatchObject({ service: null, locality: null });
  });
});

describe('renderAlert: key_disabled', () => {
  const event: AlertEvent = {
    kind: 'key_disabled',
    provider: 'groq',
    account_label: 'account-2',
    fingerprint: 'a1b2c3d4e5f6',
    reason: 'credits exhausted (HTTP 402)',
  };

  it('names the provider, account label, fingerprint and reason', () => {
    const { subject, body } = renderAlert(event);
    expect(subject).toBe('API key disabled: groq (account-2)');
    expect(body).toContain('Provider: groq');
    expect(body).toContain('Account: account-2');
    expect(body).toContain('Fingerprint: a1b2c3d4e5f6');
    expect(body).toContain('Reason: credits exhausted (HTTP 402)');
  });

  it('never prints a key, even if one is passed along by mistake', () => {
    const key = 'gsk_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKL';
    // 1. An extra field the type does not have.
    const withKeyField = { ...event, api_key: key } as unknown as AlertEvent;
    // 2. A key in the fingerprint field, and a key quoted in a provider error message.
    const withKeyInText: AlertEvent = {
      ...event,
      fingerprint: key,
      reason: `Invalid API key ${key} (401)`,
      account_label: key,
    };
    for (const e of [withKeyField, withKeyInText]) {
      const { subject, body } = renderAlert(e);
      expect(subject).not.toContain('gsk_abcdefghij');
      expect(body).not.toContain('gsk_abcdefghij');
      expect(body).not.toContain('0123456789ABCDEF');
    }
    expect(renderAlert(withKeyInText).body).toContain('[redacted]');
  });
});

describe('renderAlert: dead_man', () => {
  it('names the job and when it was last seen', () => {
    const { subject, body } = renderAlert({
      kind: 'dead_man',
      job: 'nightly-pipeline',
      last_seen: '2026-10-12T01:04:00Z',
    });
    expect(subject).toBe('Dead-man alert: nightly-pipeline has not reported');
    expect(body).toContain('Job: nightly-pipeline');
    expect(body).toContain('Last seen: 2026-10-12T01:04:00Z');
  });

  it('says "never" when the job has not been seen at all', () => {
    expect(renderAlert({ kind: 'dead_man', job: 'nightly-pipeline', last_seen: null }).body).toContain(
      'Last seen: never',
    );
  });
});

describe('renderAlert: health', () => {
  it('lists the summary lines in order', () => {
    const { subject, body } = renderAlert({
      kind: 'health',
      summary: ['Keys: 5 active, 1 cooling', 'Database: 212 MB of 500 MB', 'Dead-man: ok'],
    });
    expect(subject).toBe('Daily health report');
    expect(body).toBe('Keys: 5 active, 1 cooling\nDatabase: 212 MB of 500 MB\nDead-man: ok');
  });

  it('keeps each line to one line and caps its length', () => {
    const { body } = renderAlert({ kind: 'health', summary: ['a\nb', 'x'.repeat(2000)] });
    const lines = body.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('a b');
    expect(lines[1]?.length).toBeLessThanOrEqual(500);
  });

  it('still renders when there is nothing to report', () => {
    expect(renderAlert({ kind: 'health', summary: [] }).body).toBe('No details.');
  });
});

describe('renderAlert: bad input', () => {
  it('throws for an event kind it does not know, so alert() can report failure', () => {
    expect(() => renderAlert({ kind: 'nope' } as unknown as AlertEvent)).toThrow();
  });
});

describe('whatsappReplyLink', () => {
  const event: AlertEvent = {
    kind: 'lead',
    ref: 'MM-AB12CD',
    grade: 'A',
    lead_type: 'quote',
    service: 'waterproofing',
    locality: 'wakad',
    phone: PHONE,
  };
  const OWN_NUMBER = '919834346179';

  it("links to the customer's own number, with a greeting that carries the lead ref", () => {
    expect(whatsappReplyLink(event)).toEqual({
      label: 'Reply on WhatsApp',
      url: 'https://wa.me/919876543210?text=Hi%2C%20this%20is%20MarketMind%20AI%20about%20your%20quote%20request.%0A%0ARef%20MM-AB12CD',
    });
  });

  it('puts the greeting and the ref in the prefilled text', () => {
    const url = new URL(whatsappReplyLink(event)?.url ?? '');
    expect(url.pathname).toBe('/919876543210');
    expect(url.searchParams.get('text')).toBe(
      'Hi, this is MarketMind AI about your quote request.\n\nRef MM-AB12CD',
    );
  });

  it('uses a neutral greeting when the lead is not a quote request', () => {
    for (const lead_type of ['advertise', 'claim', 'contact', 'for_contractors'] as const) {
      const text = new URL(whatsappReplyLink({ ...event, lead_type })?.url ?? '').searchParams.get('text');
      expect(text).toBe('Hi, this is MarketMind AI about your enquiry.\n\nRef MM-AB12CD');
    }
  });

  it("never uses MarketMind AI's own number", () => {
    expect(whatsappReplyLink(event)?.url).not.toContain(OWN_NUMBER);
    for (const phone of ['', 'x', '9876543210', '+0']) {
      expect(whatsappReplyLink({ ...event, phone })?.url ?? '').not.toContain(OWN_NUMBER);
    }
  });

  it.each([
    '',
    'abc',
    '9876543210',
    '919876543210',
    '+91 98765 43210',
    '+91-98765-43210',
    '+0123456789012',
    '+12',
  ])('gives no link, and does not throw, for a phone that is not E.164 (%j)', (phone) => {
    expect(whatsappReplyLink({ ...event, phone })).toBeNull();
  });

  it.each(['', 'has space', 'a'.repeat(65), 'x\ny'])(
    'gives no link, and does not throw, for a ref wa.me cannot carry (%j)',
    (ref) => {
      expect(whatsappReplyLink({ ...event, ref })).toBeNull();
    },
  );

  it('gives no link for the other kinds of alert', () => {
    const others: AlertEvent[] = [
      {
        kind: 'key_disabled',
        provider: 'exa',
        account_label: 'main',
        fingerprint: 'a1b2c3d4e5f6',
        reason: 'auth',
      },
      { kind: 'dead_man', job: 'nightly-pipeline', last_seen: null },
      { kind: 'health', summary: ['All good'] },
    ];
    for (const other of others) expect(whatsappReplyLink(other)).toBeNull();
  });

  it('leaves the rendered subject and body without any link or full number', () => {
    const { subject, body } = renderAlert(event);
    for (const text of [subject, body]) {
      expect(text).not.toContain('wa.me');
      expect(text).not.toContain('9876543210');
    }
  });
});
