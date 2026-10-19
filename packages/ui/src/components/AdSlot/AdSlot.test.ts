import { AD_LABEL } from '@mm/core/constants';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import AdSlot from './AdSlot.astro';

const container = await AstroContainer.create();

describe('AdSlot', () => {
  it('renders nothing at all when the slot is not enabled', async () => {
    const html = await container.renderToString(AdSlot, {
      props: { slotId: 'AD_SLOT_AFTER_INTRO', enabled: false },
      slots: { default: '<p>creative</p>' },
    });
    expect(html.trim()).toBe('');
  });

  it('writes the CONTRACTS §7a slot attributes and the ad label when enabled', async () => {
    const html = await container.renderToString(AdSlot, {
      props: { slotId: 'AD_SLOT_AFTER_INTRO', enabled: true, campaign: 'cmp-1', end: '2026-11-30' },
      slots: { default: '<p>creative</p>' },
    });
    expect(html).toContain('data-mm-slot="AD_SLOT_AFTER_INTRO"');
    expect(html).toContain('data-mm-campaign="cmp-1"');
    expect(html).toContain('data-end="2026-11-30"');
    expect(html).toContain(`>${AD_LABEL}<`);
    expect(html).toContain('<p>creative</p>');
  });
});
