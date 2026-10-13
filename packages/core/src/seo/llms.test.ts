import { describe, expect, it } from 'vitest';
import { llmsTxt } from './llms.ts';

const BASE = {
  name: 'MarketMind AI Food',
  summary:
    'Dish recommendations for Pune by locality. Every claim shows its source and the date it was checked.',
};

describe('llmsTxt', () => {
  it('follows the llms.txt layout: H1, blockquote summary, details, then sections of links with notes', () => {
    const text = llmsTxt({
      ...BASE,
      details:
        'Prices are checked against the source on the stated date.\nFeatured placement is paid and labelled.',
      sections: [
        {
          title: 'Guides',
          links: [
            {
              title: 'Best Biryani in Hinjewadi, Pune',
              url: 'https://food.marketmindai.com/pune/hinjewadi/biryani/',
              note: 'Where to eat biryani in Hinjewadi, with prices and sources.',
            },
            { title: 'Best Samosa in Wakad, Pune', url: 'https://food.marketmindai.com/pune/wakad/samosa' },
          ],
        },
        {
          title: 'Optional',
          links: [
            {
              title: 'Sitemap',
              url: 'https://food.marketmindai.com/sitemap.xml',
              note: 'Every indexable page.',
            },
          ],
        },
      ],
    });
    expect(text).toBe(
      [
        '# MarketMind AI Food',
        '',
        '> Dish recommendations for Pune by locality. Every claim shows its source and the date it was checked.',
        '',
        'Prices are checked against the source on the stated date.',
        'Featured placement is paid and labelled.',
        '',
        '## Guides',
        '',
        '- [Best Biryani in Hinjewadi, Pune](https://food.marketmindai.com/pune/hinjewadi/biryani/): Where to eat biryani in Hinjewadi, with prices and sources.',
        '- [Best Samosa in Wakad, Pune](https://food.marketmindai.com/pune/wakad/samosa/)',
        '',
        '## Optional',
        '',
        '- [Sitemap](https://food.marketmindai.com/sitemap.xml): Every indexable page.',
        '',
      ].join('\n'),
    );
  });

  it('is just the H1 and summary when there is nothing else', () => {
    expect(llmsTxt({ ...BASE, sections: [] })).toBe(`# MarketMind AI Food\n\n> ${BASE.summary}\n`);
  });

  it('skips a section with no links instead of printing an empty heading', () => {
    const text = llmsTxt({
      ...BASE,
      sections: [
        { title: 'Empty', links: [] },
        { title: 'Guides', links: [{ title: 'Pune', url: 'https://food.marketmindai.com/pune/' }] },
      ],
    });
    expect(text).not.toContain('Empty');
    expect(text).toContain('## Guides');
  });

  it('keeps a multi-line summary inside the blockquote', () => {
    const text = llmsTxt({ ...BASE, summary: 'First line.\n\n  Second line.  ', sections: [] });
    expect(text).toBe('# MarketMind AI Food\n\n> First line.\n> Second line.\n');
  });

  it('keeps each link on one line and escapes brackets in its text', () => {
    const text = llmsTxt({
      ...BASE,
      sections: [
        {
          title: 'Guides',
          links: [
            {
              title: 'Pune [food]\nguide',
              url: 'https://food.marketmindai.com/pune/',
              note: 'Line one\n  line two',
            },
          ],
        },
      ],
    });
    expect(text).toContain(
      '- [Pune \\[food\\] guide](https://food.marketmindai.com/pune/): Line one line two\n',
    );
  });

  it('writes links in canonical form, including links to another host', () => {
    const text = llmsTxt({
      ...BASE,
      sections: [
        {
          title: 'Brand',
          links: [{ title: 'About', url: 'https://marketmindai.com/about?utm_source=x#top' }],
        },
      ],
    });
    expect(text).toContain('(https://marketmindai.com/about/)');
  });

  it('has no trailing spaces, no blank-line runs and a single final newline', () => {
    const text = llmsTxt({
      ...BASE,
      details: '  Details.  ',
      sections: [
        {
          title: 'Guides',
          links: [{ title: 'Pune', url: 'https://food.marketmindai.com/pune/', note: ' n ' }],
        },
      ],
    });
    expect(text).not.toMatch(/[ \t]+\n/);
    expect(text).not.toMatch(/\n{3,}/);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('rejects empty names, relative and http URLs', () => {
    expect(() => llmsTxt({ ...BASE, name: ' ', sections: [] })).toThrow(RangeError);
    expect(() => llmsTxt({ ...BASE, summary: '', sections: [] })).toThrow(RangeError);
    expect(() =>
      llmsTxt({
        ...BASE,
        sections: [{ title: ' ', links: [{ title: 'a', url: 'https://marketmindai.com/' }] }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      llmsTxt({
        ...BASE,
        sections: [{ title: 'G', links: [{ title: '', url: 'https://marketmindai.com/' }] }],
      }),
    ).toThrow(RangeError);
    expect(() =>
      llmsTxt({ ...BASE, sections: [{ title: 'G', links: [{ title: 'a', url: '/pune/' }] }] }),
    ).toThrow(RangeError);
    expect(() =>
      llmsTxt({
        ...BASE,
        sections: [{ title: 'G', links: [{ title: 'a', url: 'http://marketmindai.com/' }] }],
      }),
    ).toThrow(RangeError);
  });
});
