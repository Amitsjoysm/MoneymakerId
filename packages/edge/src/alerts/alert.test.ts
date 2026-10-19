import { env as workerEnv } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alert } from './alert.ts';
import type { AlertEvent } from './types.ts';

const { createEmailMessage } = vi.hoisted(() => ({
  createEmailMessage: vi.fn(async (from: string, to: string, raw: string) => ({ from, to, raw })),
}));
vi.mock('./email-message.ts', () => ({ createEmailMessage }));

const TOKEN = '123456789:AAH-example_token';
const send = vi.fn(async (_message: unknown) => ({ messageId: 'abc' }));
const fullEnv = {
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_CHAT_ID: '-1001234567890',
  ALERT_EMAIL: { send },
  ALERT_EMAIL_TO: 'owner@example.com',
};

const leadEvent: AlertEvent = {
  kind: 'lead',
  ref: 'C-WAKAD-WP',
  grade: 'A',
  lead_type: 'quote',
  service: 'waterproofing',
  locality: 'wakad',
  phone: '+919876543210',
};

let fetchMock: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  send.mockClear();
  createEmailMessage.mockClear();
  fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"ok":true}'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

function telegramText(): string {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return (JSON.parse(init.body as string) as { text: string }).text;
}

/** What a reader of the Telegram message sees: tags removed, entities decoded. */
function visibleTelegramText(): string {
  return telegramText()
    .replace(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}

function emailParts(): { subject: string; body: string } {
  const raw = (createEmailMessage.mock.calls[0] as [string, string, string])[2];
  const subject = /^Subject: (.*)$/m.exec(raw)?.[1] ?? '';
  const b64 = raw.slice(raw.indexOf('\r\n\r\n') + 4).replaceAll('\r\n', '');
  const body = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  return { subject: subject.trim(), body };
}

describe('alert', () => {
  it('sends to both Telegram and email, and reports each as sent', async () => {
    await expect(alert(fullEnv, leadEvent)).resolves.toEqual({ telegram: 'sent', email: 'sent' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(telegramText()).toContain('New lead C-WAKAD-WP (grade A)');
    expect(telegramText()).toContain('Phone: +91 98xxx xx210');

    const { subject, body } = emailParts();
    expect(subject).toBe('[MarketMind AI] New lead C-WAKAD-WP (grade A)');
    expect(body).toContain('Ref: C-WAKAD-WP');
    expect(body).toContain('Phone: +91 98xxx xx210');
  });

  it('never shows the full phone number: the email has none, and neither does the Telegram text you read', async () => {
    await alert(fullEnv, leadEvent);
    const raw = (createEmailMessage.mock.calls[0] as [string, string, string])[2];
    for (const text of [visibleTelegramText(), emailParts().body, raw]) {
      expect(text).not.toContain('9876543210');
    }
  });

  describe('the WhatsApp reply link on a lead', () => {
    const waLink =
      'https://wa.me/919876543210?text=Hi%2C%20this%20is%20MarketMind%20AI%20about%20your%20quote%20request.%0A%0ARef%20C-WAKAD-WP';

    it('adds exactly one "Reply on WhatsApp" link to the Telegram message, built from the lead phone and ref', async () => {
      await alert(fullEnv, leadEvent);
      const text = telegramText();
      expect(text.match(/href="/g)).toHaveLength(1);
      expect(text.match(/wa\.me/g)).toHaveLength(1);
      expect(text).toContain(`<a href="${waLink}">Reply on WhatsApp</a>`);
      expect(text).not.toContain('919834346179');
    });

    it('keeps the visible Telegram text to the masked phone', async () => {
      await alert(fullEnv, leadEvent);
      const visible = visibleTelegramText();
      expect(visible).toContain('Phone: +91 98xxx xx210');
      expect(visible).toContain('New lead C-WAKAD-WP (grade A)');
      expect(visible).not.toMatch(/\d{6,}/);
      expect(visible.endsWith('Reply on WhatsApp')).toBe(true);
    });

    it('leaves the email masked, without a link', async () => {
      await alert(fullEnv, leadEvent);
      const raw = (createEmailMessage.mock.calls[0] as [string, string, string])[2];
      const { subject, body } = emailParts();
      for (const text of [raw, subject, body]) {
        expect(text).not.toContain('wa.me');
        expect(text).not.toContain('href');
        expect(text).not.toContain('9876543210');
      }
      expect(body).toContain('Phone: +91 98xxx xx210');
    });

    it('still sends the alert, without a link, when the phone or ref cannot make one', async () => {
      await expect(alert(fullEnv, { ...leadEvent, phone: '9876543210' })).resolves.toEqual({
        telegram: 'sent',
        email: 'sent',
      });
      expect(telegramText()).not.toContain('href');
      expect(telegramText()).toContain('Phone: +91 98xxx xx210');
    });

    it('keeps the message within the 4096-character cap, link included, even with huge fields', async () => {
      const big = 'x'.repeat(10_000);
      await alert(fullEnv, { ...leadEvent, service: big, locality: big, lead_type: 'quote' });
      expect(visibleTelegramText().length).toBeLessThanOrEqual(4096);
      expect(telegramText()).toContain(`<a href="${waLink}">Reply on WhatsApp</a>`);
    });

    it('adds no link to the other kinds of alert', async () => {
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
      for (const [index, event] of others.entries()) {
        await alert(fullEnv, event);
        const init = fetchMock.mock.calls[index]?.[1] as RequestInit;
        const text = (JSON.parse(init.body as string) as { text: string }).text;
        expect(text).not.toContain('<a');
        expect(text).not.toContain('wa.me');
      }
    });
  });

  it('sends the email even when Telegram fails, and the other way round', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network connection lost'));
    await expect(alert(fullEnv, leadEvent)).resolves.toEqual({ telegram: 'failed', email: 'sent' });
    expect(send).toHaveBeenCalledTimes(1);

    send.mockRejectedValueOnce(new Error('destination address is not verified'));
    await expect(alert(fullEnv, leadEvent)).resolves.toEqual({ telegram: 'sent', email: 'failed' });
  });

  it('starts both channels before waiting for either', async () => {
    let releaseTelegram: (r: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (releaseTelegram = resolve)));
    const pending = alert(fullEnv, leadEvent);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    releaseTelegram(new Response('{"ok":true}'));
    await expect(pending).resolves.toEqual({ telegram: 'sent', email: 'sent' });
  });

  it('skips a channel that is not configured, and reports the other', async () => {
    const { TELEGRAM_BOT_TOKEN: _token, ...noTelegram } = fullEnv;
    await expect(alert(noTelegram, leadEvent)).resolves.toEqual({ telegram: 'skipped', email: 'sent' });
    expect(fetchMock).not.toHaveBeenCalled();

    const { ALERT_EMAIL: _binding, ...noEmail } = fullEnv;
    await expect(alert(noEmail, leadEvent)).resolves.toEqual({ telegram: 'sent', email: 'skipped' });
  });

  it('skips both, without throwing, when nothing is configured', async () => {
    await expect(alert({}, leadEvent)).resolves.toEqual({ telegram: 'skipped', email: 'skipped' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports failed for both, without throwing, when the event cannot be rendered', async () => {
    await expect(alert(fullEnv, null as unknown as AlertEvent)).resolves.toEqual({
      telegram: 'failed',
      email: 'failed',
    });
    await expect(alert(fullEnv, { kind: 'nope' } as unknown as AlertEvent)).resolves.toEqual({
      telegram: 'failed',
      email: 'failed',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends every kind of alert', async () => {
    const events: AlertEvent[] = [
      leadEvent,
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
    for (const event of events) {
      await expect(alert(fullEnv, event)).resolves.toEqual({ telegram: 'sent', email: 'sent' });
    }
  });

  it('keeps a very long health report within both channels’ limits', async () => {
    const summary = Array.from({ length: 2000 }, (_, i) => `Line ${i}: ${'detail '.repeat(40)}`);
    await expect(alert(fullEnv, { kind: 'health', summary })).resolves.toEqual({
      telegram: 'sent',
      email: 'sent',
    });
    expect(telegramText().length).toBeLessThanOrEqual(4096);
    expect(new TextEncoder().encode(emailParts().body).length).toBeLessThanOrEqual(50 * 1024);
  });

  it('accepts the Worker env as the runtime provides it (compile-time check)', async () => {
    // The test runtime has no Telegram secrets and no send_email binding, so both channels skip.
    await expect(alert(workerEnv, { kind: 'health', summary: ['ok'] })).resolves.toEqual({
      telegram: 'skipped',
      email: 'skipped',
    });
  });
});
