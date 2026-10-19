import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRawEmail,
  DEFAULT_ALERT_FROM,
  EMAIL_BODY_MAX_BYTES,
  EMAIL_SUBJECT_MAX_CHARS,
  sendEmail,
} from './email.ts';

// `cloudflare:email` is isolated in email-message.ts; here it is replaced by a recorder, because a real
// EmailMessage does not let you read the raw message back.
const { createEmailMessage } = vi.hoisted(() => ({
  createEmailMessage: vi.fn(async (from: string, to: string, raw: string) => ({ from, to, raw })),
}));
vi.mock('./email-message.ts', () => ({ createEmailMessage }));

const TO = 'owner@example.com';

/** Splits a raw message into unfolded headers (lower-cased names) and the decoded UTF-8 body. */
function parseRaw(raw: string) {
  const split = raw.indexOf('\r\n\r\n');
  expect(split).toBeGreaterThan(0);
  const head = raw.slice(0, split).replace(/\r\n[ \t]+/g, ' ');
  const headers = new Map<string, string>();
  for (const line of head.split('\r\n')) {
    const colon = line.indexOf(':');
    headers.set(line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim());
  }
  const b64 = raw.slice(split + 4).replaceAll('\r\n', '');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return {
    head,
    headers,
    body: new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    bodyBytes: bytes.length,
  };
}

/** Decodes a header value made of RFC 2047 encoded-words (or plain ASCII). */
function decodeHeader(value: string): string {
  const words = value.match(/=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/g);
  if (!words) return value;
  return words
    .map((w) => {
      const b64 = w.slice('=?UTF-8?B?'.length, -2);
      return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    })
    .join('');
}

const fixedParts = {
  from: 'alerts@marketmindai.com',
  to: TO,
  date: new Date('2026-10-13T10:00:00Z'),
  messageId: '11111111-2222-4333-8444-555555555555',
};

describe('buildRawEmail', () => {
  it('builds a minimal RFC 5322 text/plain message with CRLF line endings', () => {
    const raw = buildRawEmail({ ...fixedParts, subject: 'New lead C-WAKAD-WP', text: 'Line one\nLine two' });
    const { headers, body } = parseRaw(raw);

    expect(headers.get('from')).toBe('MarketMind AI <alerts@marketmindai.com>');
    expect(headers.get('to')).toBe(TO);
    expect(headers.get('subject')).toBe('New lead C-WAKAD-WP');
    expect(headers.get('date')).toBe('Tue, 13 Oct 2026 10:00:00 +0000');
    expect(headers.get('message-id')).toBe('<11111111-2222-4333-8444-555555555555@marketmindai.com>');
    expect(headers.get('mime-version')).toBe('1.0');
    expect(headers.get('content-type')).toBe('text/plain; charset=UTF-8');
    expect(headers.get('content-transfer-encoding')).toBe('base64');
    expect(body).toBe('Line one\r\nLine two');
    // Every line break in the message is CRLF.
    expect(raw.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('keeps every line within the 78-character limit, even for a long non-ASCII subject and body', () => {
    const raw = buildRawEmail({ ...fixedParts, subject: 'Sन'.repeat(40), text: 'word '.repeat(5000) });
    for (const line of raw.split('\r\n')) expect(line.length).toBeLessThanOrEqual(78);
  });

  it('encodes a non-ASCII subject as RFC 2047 encoded-words that decode back', () => {
    const subject = 'New lead ₹5,00,000 – वाकड';
    const { headers, head } = parseRaw(buildRawEmail({ ...fixedParts, subject, text: 'x' }));
    expect(head).not.toContain('₹');
    expect(decodeHeader(headers.get('subject') ?? '')).toBe(subject);
  });

  it('cannot be made to add headers through the subject (header injection)', () => {
    const raw = buildRawEmail({
      ...fixedParts,
      subject: 'Hi\r\nBcc: attacker@example.com\nX-Evil: 1',
      text: 'x',
    });
    const { headers } = parseRaw(raw);
    expect(headers.has('bcc')).toBe(false);
    expect(headers.has('x-evil')).toBe(false);
    expect(headers.get('subject')).toBe('Hi Bcc: attacker@example.com X-Evil: 1');
  });

  it('limits the subject to 120 characters', () => {
    const { headers } = parseRaw(buildRawEmail({ ...fixedParts, subject: 'S'.repeat(500), text: 'x' }));
    const subject = decodeHeader(headers.get('subject') ?? '');
    expect(subject).toHaveLength(EMAIL_SUBJECT_MAX_CHARS);
    expect(subject.endsWith('…')).toBe(true);
  });

  it('falls back to a fixed subject when the given one is empty', () => {
    const { headers } = parseRaw(buildRawEmail({ ...fixedParts, subject: ' \r\n ', text: 'x' }));
    expect(decodeHeader(headers.get('subject') ?? '')).toBe('MarketMind AI alert');
  });

  it('limits the body to 50 KB of UTF-8, cut on a character boundary', () => {
    const { body, bodyBytes } = parseRaw(
      buildRawEmail({ ...fixedParts, subject: 's', text: 'नमस्ते '.repeat(20_000) }),
    );
    expect(bodyBytes).toBeLessThanOrEqual(EMAIL_BODY_MAX_BYTES);
    expect(bodyBytes).toBeGreaterThan(EMAIL_BODY_MAX_BYTES - 8);
    expect(body.endsWith('…')).toBe(true);
  });

  it('never leaves a bare carriage return when the body limit falls between CR and LF', () => {
    // 'x\r\n' is 3 bytes, and the cut point (the limit minus the 3-byte ellipsis) is 2 bytes into a line.
    const { body, bodyBytes } = parseRaw(
      buildRawEmail({ ...fixedParts, subject: 's', text: 'x\n'.repeat(30_000) }),
    );
    expect(bodyBytes).toBeLessThanOrEqual(EMAIL_BODY_MAX_BYTES);
    expect(body.endsWith('…')).toBe(true);
    expect(body).not.toMatch(/\r(?!\n)/);
    expect(body).not.toMatch(/(?<!\r)\n/);
  });
});

describe('sendEmail', () => {
  const send = vi.fn(async (_message: unknown) => ({ messageId: 'abc' }));
  let warn: ReturnType<typeof vi.spyOn>;
  const env = { ALERT_EMAIL: { send }, ALERT_EMAIL_TO: TO };

  beforeEach(() => {
    send.mockClear();
    createEmailMessage.mockClear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends one message through the binding, from the default alerts address to the configured owner', async () => {
    await expect(sendEmail(env, { subject: 'Subject', text: 'Body' })).resolves.toBe('sent');

    expect(send).toHaveBeenCalledTimes(1);
    expect(createEmailMessage).toHaveBeenCalledTimes(1);
    const [from, to, raw] = createEmailMessage.mock.calls[0] as [string, string, string];
    expect(from).toBe(DEFAULT_ALERT_FROM);
    expect(DEFAULT_ALERT_FROM).toBe('alerts@marketmindai.com');
    expect(to).toBe(TO);
    const parsed = parseRaw(raw);
    expect(parsed.headers.get('subject')).toBe('Subject');
    expect(parsed.body).toBe('Body');
    // What goes to the binding is what createEmailMessage returned.
    expect(send.mock.calls[0]?.[0]).toEqual({ from, to, raw });
  });

  it('uses ALERT_EMAIL_FROM when it is set', async () => {
    await sendEmail({ ...env, ALERT_EMAIL_FROM: 'noreply@marketmindai.com' }, { subject: 's', text: 't' });
    expect(createEmailMessage.mock.calls[0]?.[0]).toBe('noreply@marketmindai.com');
  });

  it.each([
    ['no binding', { ALERT_EMAIL_TO: TO }],
    ['no destination address', { ALERT_EMAIL: { send } }],
    ['a blank destination address', { ALERT_EMAIL: { send }, ALERT_EMAIL_TO: ' ' }],
    ['an empty env', {}],
  ])('skips, sending nothing, when configuration is missing (%s)', async (_name, partial) => {
    await expect(sendEmail(partial, { subject: 's', text: 't' })).resolves.toBe('skipped');
    expect(send).not.toHaveBeenCalled();
  });

  it.each(['not-an-address', 'a@b', 'x@example.com\r\nBcc: y@example.com', 'Name <x@example.com>'])(
    'refuses a malformed destination address (%j), without sending',
    async (to) => {
      await expect(sendEmail({ ...env, ALERT_EMAIL_TO: to }, { subject: 's', text: 't' })).resolves.toBe(
        'failed',
      );
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('reports failed when the binding rejects, without throwing', async () => {
    send.mockRejectedValueOnce(new Error('destination address is not verified'));
    await expect(sendEmail(env, { subject: 's', text: 't' })).resolves.toBe('failed');
    expect(warn).toHaveBeenCalled();
  });

  it('reports failed when the binding throws synchronously', async () => {
    send.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(sendEmail(env, { subject: 's', text: 't' })).resolves.toBe('failed');
  });

  it('reports failed when the message cannot be created', async () => {
    createEmailMessage.mockRejectedValueOnce(new Error('cloudflare:email is not available'));
    await expect(sendEmail(env, { subject: 's', text: 't' })).resolves.toBe('failed');
    expect(send).not.toHaveBeenCalled();
  });
});
