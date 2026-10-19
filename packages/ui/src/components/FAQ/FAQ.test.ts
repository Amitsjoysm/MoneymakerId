import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import FAQ from './FAQ.astro';

const container = await AstroContainer.create();

describe('FAQ', () => {
  it('renders a headed section of native disclosure questions', async () => {
    const html = await container.renderToString(FAQ, {
      props: {
        title: 'Questions about terrace waterproofing',
        items: [
          { question: 'How long does it take?', answer: 'Example answer one.' },
          { question: 'Can it be done in the monsoon?', answer: 'Example answer two.' },
        ],
      },
    });
    expect(html).toMatch(/<section[^>]*aria-labelledby="([^"]+)"[\s\S]*<h2[^>]*id="\1"/);
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).toMatch(/<summary[^>]*>[\s\S]*How long does it take\?/);
    expect(html).toContain('Example answer two.');
  });
});
