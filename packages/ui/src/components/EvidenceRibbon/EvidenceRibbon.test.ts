import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import RibbonEstimate from './RibbonEstimate.astro';
import SourceBundle from './SourceBundle.astro';
import SourceSlip from './SourceSlip.astro';

const container = await AstroContainer.create();

// Synthetic source (test only): an "Example" publisher on an example.com URL.
const source = {
  url: 'https://example.com/terrace-rates',
  title: 'Example terrace rates',
  publisher: 'Example Rates Desk',
  retrieved_at: '2026-10-06',
  quote: 'Terrace coating: ₹35–₹60 per sq ft',
};

/** The text of the <summary>, which is the slip's accessible name. */
function summaryText(html: string): string {
  const summary = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(html)?.[1] ?? '';
  return summary
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('SourceSlip', () => {
  it('is a <details> node whose summary names the publisher, the figure and the check date', async () => {
    const html = await container.renderToString(SourceSlip, { props: { source, figure: '₹35–₹60', scope: 'Pune' } });
    expect(html).toMatch(/<li class="mm-ev__step"[^>]*data-line="solid"/);
    expect(html).toContain('<details class="mm-slip"');
    expect(summaryText(html)).toBe('Example Rates Desk ₹35–₹60 Checked 6 Oct 2026 · Pune');
    expect(html).toContain('<time datetime="2026-10-06">');
  });

  it('unfolds the quote and a link to the source in place', async () => {
    const html = await container.renderToString(SourceSlip, { props: { source } });
    expect(html).toContain(`“${source.quote}”`);
    expect(html).toMatch(/<a [^>]*href="https:\/\/example\.com\/terrace-rates"[^>]*rel="noopener external"/);
  });

  it('strikes a stale figure, marks it in signal and says so in words', async () => {
    const html = await container.renderToString(SourceSlip, { props: { source, figure: '₹35–₹60', stale: true } });
    expect(html).toContain('data-line="stale"');
    expect(html).toContain('data-node="stale"');
    expect(html).toMatch(/<s class="mm-slip__fig">₹35–₹60<\/s>/);
    expect(summaryText(html)).toContain('Outdated');
  });
});

describe('SourceBundle', () => {
  it('folds the remaining sources into one slip named by their count', async () => {
    const other = { ...source, publisher: 'Example Paint Co', url: 'https://example.com/paint' };
    const html = await container.renderToString(SourceBundle, {
      props: { sources: [{ source }, { source: other, figure: '₹55' }] },
    });
    expect(summaryText(html)).toMatch(/^2 more sources Example Rates Desk, Example Paint Co · checked 6 Oct 2026$/);
    expect(html).toContain('data-node="bundle"');
    expect(html).toContain('href="https://example.com/paint"');
  });
});

describe('RibbonEstimate', () => {
  const props = {
    rate: { low: 35, expected: 55, high: 100, min_job_inr: null },
    unit: 'sqft' as const,
    presets: [
      { value: 'terrace', label: 'Terrace', detail: '1,000 sq ft', low: 35_000, expected: 55_000, high: 100_000 },
      { value: 'independent_house', label: 'House roof', detail: '900 sq ft', low: 31_500, expected: 49_500, high: 90_000 },
    ],
    note: 'Rate × area.',
  };

  it('rides a dashed segment and shows each preset total, the first one chosen', async () => {
    const html = await container.renderToString(RibbonEstimate, { props });
    expect(html).toContain('data-line="dashed"');
    expect(html).toContain('data-node="estimate"');
    expect(html).toMatch(/<input[^>]*value="terrace"[^>]*checked/);
    expect(html).toContain('₹35,000–₹1,00,000');
    expect(html).toContain('₹31,500–₹90,000');
  });

  it('keeps the "your area" choice hidden until the script can compute it', async () => {
    const html = await container.renderToString(RibbonEstimate, { props });
    expect(html).toMatch(/<label class="mm-chip"[^>]*hidden[^>]*>[\s\S]*?value="custom"/);
    expect(html).toContain('data-mm-estimate=');
  });
});
