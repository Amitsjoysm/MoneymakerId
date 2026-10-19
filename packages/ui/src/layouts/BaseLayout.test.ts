import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import BaseLayout from './BaseLayout.astro';

const container = await AstroContainer.create();

const seo = {
  title: 'Terrace Waterproofing Cost in Pune | MarketMind AI',
  description: 'Estimate terrace waterproofing costs in Pune.',
  canonical: 'https://construction.marketmindai.com/pune/terrace-waterproofing-cost/',
  robots: 'index,follow',
  jsonLd: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'A </script> test' },
};

describe('BaseLayout', () => {
  it('writes the CONTRACTS §7a body attributes and the vertical theme on <html>', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: { host: 'construction', pageType: 'service_cost', locality: 'wakad', subject: 'terrace-waterproofing', variant: 'b', seo },
    });
    expect(html).toMatch(/<html[^>]*lang="en"/);
    expect(html).toMatch(/<html[^>]*data-vertical="construction"/);
    const body = /<body[^>]*>/.exec(html)?.[0] ?? '';
    expect(body).toContain('data-host="construction"');
    expect(body).toContain('data-page-type="service_cost"');
    expect(body).toContain('data-locality="wakad"');
    expect(body).toContain('data-subject="terrace-waterproofing"');
    expect(body).toContain('data-variant="b"');
  });

  it('leaves out the optional body attributes that are null', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: { host: 'main', pageType: 'home', seo },
    });
    const body = /<body[^>]*>/.exec(html)?.[0] ?? '';
    expect(body).toContain('data-host="main"');
    expect(body).not.toContain('data-locality');
    expect(body).not.toContain('data-variant');
  });

  it('renders the SEO head from ready-made props, with JSON-LD that cannot close its script tag', async () => {
    const html = await container.renderToString(BaseLayout, { props: { host: 'construction', pageType: 'service_cost', seo } });
    expect(html).toContain(`<title>${seo.title}</title>`);
    expect(html).toContain(`<link rel="canonical" href="${seo.canonical}">`);
    expect(html).toContain('<meta name="robots" content="index,follow">');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).not.toContain('A </script> test');
    expect(html).toMatch(/<link rel="preload"[^>]*as="font"[^>]*type="font\/woff2"[^>]*crossorigin/);
  });
});
