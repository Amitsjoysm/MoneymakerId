import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeTelegramHtml, sendTelegram, TELEGRAM_MAX_CHARS } from './telegram.ts';

const TOKEN = '123456789:AAH-example_token';
const CHAT = '-1001234567890';
const env = { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT };

let fetchMock: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"ok":true}'));
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** The JSON body of the n-th fetch call. */
function sentBody(call = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe('escapeTelegramHtml', () => {
  it('escapes the three characters Telegram HTML mode treats as markup', () => {
    expect(escapeTelegramHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    expect(escapeTelegramHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('sendTelegram', () => {
  it('posts to the bot API with chat_id, HTML parse mode and no link preview, and reports sent', async () => {
    await expect(sendTelegram(env, 'Hello')).resolves.toBe('sent');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(sentBody()).toEqual({
      chat_id: CHAT,
      text: 'Hello',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  });

  it('escapes < > & in the text', async () => {
    await sendTelegram(env, 'Fish & <b>chips</b>');
    expect(sentBody().text).toBe('Fish &amp; &lt;b&gt;chips&lt;/b&gt;');
  });

  it('truncates to 4096 characters, with an ellipsis, counting the text Telegram will show', async () => {
    await sendTelegram(env, 'a'.repeat(5000));
    const plain = sentBody().text as string;
    expect(plain).toHaveLength(TELEGRAM_MAX_CHARS);
    expect(plain.endsWith('…')).toBe(true);

    // The limit applies after Telegram parses the entities, so escaping must not eat into it.
    fetchMock.mockClear();
    await sendTelegram(env, '<'.repeat(5000));
    const escaped = sentBody().text as string;
    const shown = escaped.replaceAll('&lt;', '<');
    expect(shown).toHaveLength(TELEGRAM_MAX_CHARS);
    expect(escaped.endsWith('…')).toBe(true);
  });

  it('sends text that fits as it is', async () => {
    await sendTelegram(env, 'x'.repeat(TELEGRAM_MAX_CHARS));
    expect(sentBody().text).toBe('x'.repeat(TELEGRAM_MAX_CHARS));
  });

  it.each([
    ['no token', { TELEGRAM_CHAT_ID: CHAT }],
    ['no chat id', { TELEGRAM_BOT_TOKEN: TOKEN }],
    ['blank token', { TELEGRAM_BOT_TOKEN: '  ', TELEGRAM_CHAT_ID: CHAT }],
    ['blank chat id', { TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: '' }],
    ['an empty env', {}],
  ])('skips, without calling the network, when configuration is missing (%s)', async (_name, partial) => {
    await expect(sendTelegram(partial, 'Hello')).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips an empty message', async () => {
    await expect(sendTelegram(env, '   \n ')).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 429, 500, 502])('reports failed on HTTP %i, without throwing', async (status) => {
    fetchMock.mockImplementation(async () => new Response('{"ok":false}', { status }));
    await expect(sendTelegram(env, 'Hello')).resolves.toBe('failed');
  });

  it('reports failed when the request rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network connection lost'));
    await expect(sendTelegram(env, 'Hello')).resolves.toBe('failed');
  });

  it('reports failed when fetch throws synchronously', async () => {
    fetchMock.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(sendTelegram(env, 'Hello')).resolves.toBe('failed');
  });

  it('gives the request a timeout signal, so a hung connection cannot stall the caller', async () => {
    await sendTelegram(env, 'Hello');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('never writes the bot token to the logs', async () => {
    fetchMock.mockImplementation(async () => new Response('{"ok":false}', { status: 401 }));
    await sendTelegram(env, 'Hello');
    fetchMock.mockRejectedValue(
      new Error(`request to https://api.telegram.org/bot${TOKEN}/sendMessage failed`),
    );
    await sendTelegram(env, 'Hello');

    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('AAH-example_token');
  });
});

describe('sendTelegram with a link', () => {
  const link = {
    label: 'Reply on WhatsApp',
    url: 'https://wa.me/919876543210?text=Hi%2C%20there%0A%0ARef%20MM-AB12CD',
  };

  /** What Telegram shows: the tags removed and the entities decoded. */
  function shown(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&');
  }

  it('adds one HTML link on its own line after the escaped text', async () => {
    await expect(sendTelegram(env, 'Fish & chips', { link })).resolves.toBe('sent');
    expect(sentBody().text).toBe(`Fish &amp; chips\n<a href="${link.url}">Reply on WhatsApp</a>`);
    expect(sentBody().parse_mode).toBe('HTML');
  });

  it('escapes the label, and the quote and markup characters of the address', async () => {
    await sendTelegram(env, 'Hello', {
      link: { label: 'A <b> & C', url: 'https://example.com/?a=1&b="2"<3>' },
    });
    expect(sentBody().text).toBe(
      'Hello\n<a href="https://example.com/?a=1&amp;b=&quot;2&quot;&lt;3&gt;">A &lt;b&gt; &amp; C</a>',
    );
  });

  it('cuts the text, not the link, so the message stays within 4096 characters as Telegram counts them', async () => {
    await sendTelegram(env, 'a'.repeat(6000), { link });
    const text = sentBody().text as string;
    expect(text.endsWith(`<a href="${link.url}">Reply on WhatsApp</a>`)).toBe(true);
    expect(text.match(/<a /g)).toHaveLength(1);
    expect(shown(text)).toHaveLength(TELEGRAM_MAX_CHARS);
    expect(shown(text)).toContain('…\nReply on WhatsApp');

    // Text that fits is not cut, and the link brings it to exactly the limit.
    fetchMock.mockClear();
    const room = TELEGRAM_MAX_CHARS - 1 - link.label.length;
    await sendTelegram(env, 'b'.repeat(room), { link });
    expect(shown(sentBody().text as string)).toHaveLength(TELEGRAM_MAX_CHARS);
    expect(sentBody().text as string).not.toContain('…');
  });

  it('does not send a link on its own: with no text there is nothing to send', async () => {
    await expect(sendTelegram(env, '   ', { link })).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends exactly what it sent before when there is no link', async () => {
    await sendTelegram(env, 'Hello');
    await sendTelegram(env, 'Hello', {});
    await sendTelegram(env, 'Hello', { link: undefined });
    for (const call of [0, 1, 2]) expect(sentBody(call).text).toBe('Hello');
  });
});
