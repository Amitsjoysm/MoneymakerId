import { AD_LABEL, AFFILIATE_DISCLOSURE, COST_DISCLAIMER, FEATURED_DISCLOSURE } from '@mm/core/constants';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Disclosure from './Disclosure.astro';

const container = await AstroContainer.create();

describe('Disclosure', () => {
  it.each([
    ['featured', FEATURED_DISCLOSURE],
    ['ad', AD_LABEL],
    ['affiliate', AFFILIATE_DISCLOSURE],
    ['cost', COST_DISCLAIMER],
  ] as const)('renders the exact %s string from @mm/core/constants', async (kind, text) => {
    const html = await container.renderToString(Disclosure, { props: { kind } });
    const shown = /<span class="mm-disclosure__text">([^<]*)<\/span>/.exec(html)?.[1];
    expect(shown).toBe(text);
    expect(html).toContain(`data-kind="${kind}"`);
  });
});
