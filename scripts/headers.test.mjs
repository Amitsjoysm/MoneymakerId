// Tests for scripts/headers.mjs. Run with: node --test scripts/headers.test.mjs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { buildHeaders } from './headers.mjs';

// Real-looking digests: SHA-256 (44 base64 characters) and SHA-384 (64).
const H1 = 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
const H2 = 'sha256-n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=';
const H3 = 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC';

/** Parses the `_headers` text into `{ path: { 'Header-Name': 'value' } }`. */
function parse(text) {
  const rules = {};
  let current = null;
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      current = {};
      rules[line] = current;
      continue;
    }
    const idx = line.indexOf(':');
    current[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return rules;
}

/** The directive map of one CSP value: `{ 'script-src': ["'self'", ...] }`. */
function directives(csp) {
  return Object.fromEntries(
    csp
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values];
      }),
  );
}

const rootRule = (opts) => parse(buildHeaders(opts))['/*'];
const cspOf = (opts) => directives(rootRule(opts)['Content-Security-Policy']);
const includes = (list, value, what = 'list') =>
  assert.ok(list.includes(value), `${what} should include ${value}, got: ${list.join(' ')}`);
const excludes = (list, value, what = 'list') =>
  assert.ok(!list.includes(value), `${what} should not include ${value}, got: ${list.join(' ')}`);

describe('buildHeaders: file shape', () => {
  it('writes exactly one rule, for /*, with two-space indented headers and a final newline', () => {
    const text = buildHeaders({ launched: true, hashes: { script: [H1], style: [H2] } });
    assert.deepEqual(Object.keys(parse(text)), ['/*']);
    assert.ok(text.endsWith('\n'));
    assert.ok(!text.includes('\r'));
    for (const line of text.split('\n')) {
      if (line && !line.startsWith('#') && line !== '/*') assert.ok(line.startsWith('  '), line);
    }
  });

  it('keeps every header line under the Cloudflare _headers limit of 2000 characters', () => {
    const text = buildHeaders({ launched: false, hashes: { script: [H1, H2, H3], style: [H1] } });
    for (const line of text.split('\n')) assert.ok(line.length <= 2000, `${line.length} characters`);
  });

  it('throws, instead of writing a file Cloudflare would reject, when a header line is too long', () => {
    const many = Array.from({ length: 40 }, (_, i) => `sha256-${String(i).padStart(43, 'A')}=`);
    assert.throws(() => buildHeaders({ launched: true, hashes: { script: many } }), /2000/);
  });

  it('is deterministic and does not depend on the order of the hashes', () => {
    const a = buildHeaders({ launched: true, hashes: { script: [H1, H2, H3], style: [H3, H1] } });
    const b = buildHeaders({ launched: true, hashes: { script: [H3, H2, H1], style: [H1, H3] } });
    assert.equal(a, b);
  });
});

describe('buildHeaders: fixed security headers', () => {
  const headers = rootRule({ launched: true });

  it('sets HSTS for one year or more, including subdomains', () => {
    const hsts = headers['Strict-Transport-Security'];
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1]);
    assert.ok(maxAge >= 31536000, hsts);
    assert.ok(hsts.includes('includeSubDomains'), hsts);
  });

  it('sets nosniff and the Referrer-Policy from the plan', () => {
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  });

  it('allows geolocation for the page itself only and denies the sensors we never use', () => {
    const policy = headers['Permissions-Policy'];
    assert.ok(policy.includes('geolocation=(self)'), policy);
    assert.ok(policy.includes('camera=()'), policy);
    assert.ok(policy.includes('microphone=()'), policy);
    assert.ok(!/geolocation=\(\*\)|geolocation=\*/.test(policy), policy);
  });
});

describe('buildHeaders: X-Robots-Tag', () => {
  it('adds X-Robots-Tag: noindex while the site is not launched', () => {
    assert.equal(rootRule({ launched: false })['X-Robots-Tag'], 'noindex');
  });

  it('omits X-Robots-Tag once the site is launched', () => {
    assert.ok(!('X-Robots-Tag' in rootRule({ launched: true })));
  });

  it('refuses a launched flag that is not a real boolean (a string "false" would be truthy)', () => {
    for (const launched of ['false', 'true', undefined, null, 0, 1]) {
      assert.throws(() => buildHeaders({ launched }), /launched/, String(launched));
    }
  });
});

describe('buildHeaders: Content-Security-Policy', () => {
  const csp = cspOf({ launched: true, hashes: { script: [H1, H3], style: [H2] } });

  it('locks down the defaults', () => {
    assert.deepEqual(csp['default-src'], ["'self'"]);
    assert.deepEqual(csp['object-src'], ["'none'"]);
    assert.deepEqual(csp['base-uri'], ["'self'"]);
    assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
    assert.deepEqual(csp['form-action'], ["'self'"]);
  });

  it('puts the script hashes in script-src, quoted, and never allows unsafe script execution', () => {
    includes(csp['script-src'], `'${H1}'`, 'script-src');
    includes(csp['script-src'], `'${H3}'`, 'script-src');
    excludes(csp['script-src'], `'${H2}'`, 'script-src');
    includes(csp['script-src'], "'self'", 'script-src');
    excludes(csp['script-src'], "'unsafe-inline'", 'script-src');
    excludes(csp['script-src'], "'unsafe-eval'", 'script-src');
  });

  it('puts the style hashes in style-src and does not allow unsafe-inline styles', () => {
    includes(csp['style-src'], `'${H2}'`, 'style-src');
    excludes(csp['style-src'], `'${H1}'`, 'style-src');
    excludes(csp['style-src'], "'unsafe-inline'", 'style-src');
  });

  it('allowlists Google Tag Manager and GA4, AdSense, Turnstile and Cloudflare Web Analytics', () => {
    for (const host of [
      'https://www.googletagmanager.com',
      'https://pagead2.googlesyndication.com',
      'https://challenges.cloudflare.com',
      'https://static.cloudflareinsights.com',
    ]) {
      includes(csp['script-src'], host, 'script-src');
    }
    includes(csp['frame-src'], 'https://challenges.cloudflare.com', 'frame-src');
    includes(csp['connect-src'], 'https://*.google-analytics.com', 'connect-src');
    includes(csp['connect-src'], 'https://cloudflareinsights.com', 'connect-src');
  });

  it('works with no hashes at all (a page with no inline script or style)', () => {
    for (const hashes of [undefined, {}, { script: [], style: [] }]) {
      const only = cspOf({ launched: true, hashes });
      assert.deepEqual(
        only['script-src'].filter((v) => v.startsWith("'sha")),
        [],
      );
      assert.deepEqual(only['style-src'], ["'self'"]);
    }
  });

  it('accepts hashes that are already quoted, and lists each one once', () => {
    const quoted = cspOf({ launched: true, hashes: { script: [`'${H1}'`, H1, H1] } });
    assert.equal(quoted['script-src'].filter((v) => v === `'${H1}'`).length, 1);
  });

  it('rejects anything that is not a CSP hash source (injection guard)', () => {
    const bad = [
      "sha256-abc'; script-src *",
      'sha256-abc= https://evil.example',
      'sha256-abc=\nSet-Cookie: x=1',
      'md5-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=',
      'https://evil.example',
      "'unsafe-inline'",
      '',
      42,
    ];
    for (const value of bad) {
      assert.throws(() => buildHeaders({ launched: true, hashes: { script: [value] } }), /hash/i, String(value));
      assert.throws(() => buildHeaders({ launched: true, hashes: { style: [value] } }), /hash/i, String(value));
    }
  });

  it('rejects a hash list that is not an array', () => {
    assert.throws(() => buildHeaders({ launched: true, hashes: { script: H1 } }), /array/);
  });

  it('property: every valid hash given appears exactly once in script-src and nowhere else', () => {
    const digest = fc
      .uint8Array({ minLength: 32, maxLength: 32 })
      .map((bytes) => `sha256-${Buffer.from(bytes).toString('base64')}`);
    fc.assert(
      fc.property(fc.uniqueArray(digest, { maxLength: 8 }), (script) => {
        const parsed = cspOf({ launched: true, hashes: { script } });
        for (const h of script) {
          assert.equal(parsed['script-src'].filter((v) => v === `'${h}'`).length, 1);
          excludes(parsed['style-src'], `'${h}'`, 'style-src');
        }
      }),
      { numRuns: 50 },
    );
  });

  it('does not change the hashes it is given', () => {
    const script = [H2, H1];
    buildHeaders({ launched: true, hashes: { script, style: [] } });
    assert.deepEqual(script, [H2, H1]);
  });
});
