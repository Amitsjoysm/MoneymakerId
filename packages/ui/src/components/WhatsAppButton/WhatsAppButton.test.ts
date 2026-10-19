import { whatsappUrl } from '@mm/core/leads';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import WhatsAppButton from './WhatsAppButton.astro';

const container = await AstroContainer.create();

describe('WhatsAppButton', () => {
  it('is a tracked link to the wa.me URL built by @mm/core/leads', async () => {
    const href = whatsappUrl({ text: 'Hi', ref: 'C-PUNE-TWP' });
    const html = await container.renderToString(WhatsAppButton, { props: { href } });
    expect(html).toContain(`href="${href.replaceAll('&', '&amp;')}"`);
    expect(html).toContain('data-mm-event="whatsapp_click"');
    expect(html).toContain('Get a quote on WhatsApp');
  });

  it('refuses any link that did not come from whatsappUrl()', async () => {
    await expect(
      container.renderToString(WhatsAppButton, { props: { href: 'https://wa.me/919876543210' } }),
    ).rejects.toThrow(/whatsappUrl/);
  });
});
