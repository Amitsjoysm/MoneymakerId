import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Breadcrumbs from './Breadcrumbs.astro';

const container = await AstroContainer.create();

const items = [
  { label: 'Pune', href: '/pune/', place: true },
  { label: 'Waterproofing', href: '/pune/waterproofing-cost/' },
  { label: 'Terrace waterproofing' },
];

describe('Breadcrumbs', () => {
  it('is a labelled nav with an ordered trail, the last item marked as the current page', async () => {
    const html = await container.renderToString(Breadcrumbs, { props: { items } });
    expect(html).toMatch(/<nav[^>]*aria-label="Breadcrumb"/);
    expect(html).toContain('<a href="/pune/waterproofing-cost/"');
    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>Terrace waterproofing<\/span>/);
    expect(html.match(/<li/g)).toHaveLength(3);
  });

  it('marks a locality crumb with the place marker', async () => {
    const html = await container.renderToString(Breadcrumbs, { props: { items } });
    expect(html).toMatch(/<a href="\/pune\/"[^>]*class="[^"]*mm-crumbs__place/);
  });
});
