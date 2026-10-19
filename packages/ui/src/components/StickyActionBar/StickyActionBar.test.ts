import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import StickyActionBar from './StickyActionBar.astro';

const container = await AstroContainer.create();

describe('StickyActionBar', () => {
  it('is a labelled region holding the action, with a close button that only appears once its script runs', async () => {
    const html = await container.renderToString(StickyActionBar, {
      props: { label: 'Quick quote', title: '₹35–₹100 per sq ft' },
      slots: { default: '<a href="#quote">Get a quote</a>' },
    });
    expect(html).toMatch(/<aside[^>]*aria-label="Quick quote"/);
    expect(html).toContain('<a href="#quote">Get a quote</a>');
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-label="Hide this bar"[^>]*hidden/);
  });

  it('can sit in the page flow (fixtures, previews) instead of on the viewport', async () => {
    const html = await container.renderToString(StickyActionBar, {
      props: { label: 'Quick quote', title: 'Title', inline: true },
      slots: { default: '<a href="#quote">Get a quote</a>' },
    });
    expect(html).toContain('data-inline');
  });
});
