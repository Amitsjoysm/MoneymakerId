import { FEATURED_DISCLOSURE } from '@mm/core/constants';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import RecommendationCard from './RecommendationCard.astro';

const container = await AstroContainer.create();

const base = {
  entityId: '7d0f2f56-3c39-4a51-9a0e-2d5d1c1b9f10',
  runId: '0b6a3c43-5c55-4d3e-8f51-7e0c2a9d4e21',
  position: 2,
  name: 'Example Waterproofing Works',
  href: '/provider/example-waterproofing-works/',
  locality: { id: 'wakad', name: 'Wakad' },
};

describe('RecommendationCard', () => {
  it('stamps the CONTRACTS §7a recommendation attributes on the item', async () => {
    const html = await container.renderToString(RecommendationCard, { props: base });
    expect(html).toContain(`data-mm-entity="${base.entityId}"`);
    expect(html).toContain(`data-mm-run="${base.runId}"`);
    expect(html).toContain('data-mm-pos="2"');
  });

  it('labels paid placement with the featured disclosure and a trackable featured click', async () => {
    const html = await container.renderToString(RecommendationCard, { props: { ...base, featured: true } });
    expect(html).toContain(`>${FEATURED_DISCLOSURE}<`);
    expect(html).toContain('data-mm-event="featured_click"');
  });

  it('shows no featured wording on an organic item', async () => {
    const html = await container.renderToString(RecommendationCard, { props: base });
    expect(html).not.toContain(FEATURED_DISCLOSURE);
    expect(html).not.toContain('featured_click');
  });
});
