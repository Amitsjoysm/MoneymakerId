// Tests for scripts/secret-scan.mjs. They run the real command line against the planted fixtures in
// scripts/fixtures/secret-scan/ (every value there is obviously fake) and against small files written to a
// temporary folder. Run with: node --test scripts/secret-scan.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./secret-scan.mjs', import.meta.url));
const fixtures = fileURLToPath(new URL('./fixtures/secret-scan/', import.meta.url));
const plantedDir = join(fixtures, 'planted');
const cleanDir = join(fixtures, 'clean');
const planted = (name) => join(plantedDir, name);

function run(...args) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: `${result.stdout}${result.stderr}`,
  };
}

const scratch = mkdtempSync(join(tmpdir(), 'secret-scan-test-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

let counter = 0;
// Writes `content` to a new file in a new folder and scans that folder.
function scanContent(content, name = 'file.txt') {
  const dir = join(scratch, `case-${(counter += 1)}`);
  mkdirSync(dir);
  writeFileSync(join(dir, name), content);
  return { dir, file: join(dir, name), ...run(dir) };
}

const UUID = '00000000-0000-4000-8000-000000000000';

describe('planted secrets are caught', () => {
  // `secret` is the text that must never be printed in full; `shown` is the public prefix that may be.
  const cases = [
    {
      file: 'sb-secret.txt',
      rule: 'supabase-secret-key',
      secret: 'sb_secret_FAKE_FIXTURE_NOT_A_REAL_KEY',
      shown: 'sb_secret_',
    },
    {
      file: 'groq-key.txt',
      rule: 'groq-api-key',
      secret: 'gsk_FAKEFIXTURENOTAREALKEY0000000000',
      shown: 'gsk_',
    },
    {
      file: 'firecrawl-key.txt',
      rule: 'firecrawl-api-key',
      secret: 'fc-0123456789abcdef0123456789abcdef',
      shown: 'fc-',
    },
    {
      file: 'exa-key.txt',
      rule: 'exa-api-key',
      secret: 'main:00000000-0000-4000-8000-000000000000,backup:11111111-1111-4111-8111-111111111111',
      shown: '',
    },
    {
      file: 'private-key.txt',
      rule: 'private-key',
      secret: 'NOT-A-REAL-KEY-FIXTURE',
      shown: '-----BEGIN RSA PRIVATE KEY-----',
    },
    {
      file: 'service-role-jwt.txt',
      rule: 'supabase-service-role-jwt',
      secret:
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoiZml4dHVyZS1ub3QtcmVhbCJ9.FAKE-SIGNATURE-NOT-REAL',
      shown: 'eyJ',
    },
  ];

  for (const { file, rule, secret, shown } of cases) {
    it(`${rule} in ${file}`, () => {
      const path = planted(file);
      const result = run(path);
      assert.equal(result.status, 1, result.output);
      assert.ok(result.stderr.includes(`${path}:2`), `expected ${path}:2 in:\n${result.output}`);
      assert.ok(result.stderr.includes(rule), `expected rule ${rule} in:\n${result.output}`);
      assert.ok(result.output.includes(shown), `expected the public prefix ${shown}`);
      assert.ok(!result.output.includes(secret), 'the full secret was printed');
      assert.ok(!result.output.includes(secret.slice(-8)), 'the tail of the secret was printed');
    });
  }

  it('finds a key inside a minified one-line bundle in a nested folder', () => {
    const result = run(plantedDir);
    assert.equal(result.status, 1, result.output);
    assert.ok(result.stderr.includes(`${planted('nested/deeper/bundle.min.txt')}:1`), result.output);
    assert.ok(!result.output.includes('FAKEFIXTURENOTAREALKEY1111111111'), 'the full secret was printed');
  });

  it('reports every planted file when the whole folder is scanned', () => {
    const result = run(plantedDir);
    assert.equal(result.status, 1, result.output);
    for (const { rule } of cases)
      assert.ok(result.stderr.includes(rule), `expected ${rule} in:\n${result.output}`);
    const findings = result.stderr.split('\n').filter((line) => /\.txt:\d+/.test(line));
    assert.equal(findings.length, 7, `expected 7 findings, got:\n${result.stderr}`);
  });
});

describe('clean input passes', () => {
  it('benign files and lookalikes exit 0 and say so', () => {
    const result = run(cleanDir);
    assert.equal(result.status, 0, result.output);
    assert.match(result.stdout, /no secrets found/i);
    assert.equal(result.stderr, '');
  });

  it('an anon or authenticated JWT is not a service-role key', () => {
    const result = run(join(cleanDir, 'lookalikes.txt'));
    assert.equal(result.status, 0, result.output);
  });

  it('keys that are too short are ignored', () => {
    const result = scanContent(
      'sb_secret_short gsk_abc fc-abcdef0123 eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYW5vbiJ9.x\n',
    );
    assert.equal(result.status, 0, result.output);
  });
});

describe('Exa keys', () => {
  const positives = [
    ['an upper-case variable', `EXA_API_KEY=${UUID}`],
    ['a quoted JSON property', `{"EXA_API_KEY": "${UUID}"}`],
    ['a camel-case property in minified code', `var c={exaApiKey:"${UUID}"};`],
    ['a prefixed variable', `PUBLIC_EXA_KEY = '${UUID}'`],
    ['a hyphenated name', `exa-api-key: ${UUID}`],
    ['a labelled pool entry', `EXA_API_KEYS="main:${UUID}"`],
  ];
  for (const [name, text] of positives) {
    it(`is found in ${name}`, () => {
      const result = scanContent(`${text}\n`);
      assert.equal(result.status, 1, result.output);
      assert.ok(result.stderr.includes('exa-api-key'), result.output);
      assert.ok(!result.output.includes(UUID), 'the full key was printed');
    });
  }

  const negatives = [
    ['example_id', `const example_id = "${UUID}";`],
    ['EXAMPLE_ID', `EXAMPLE_ID=${UUID}`],
    ['EXACT_MATCH_ID', `EXACT_MATCH_ID=${UUID}`],
    ['hexagon', `const hexagon = "${UUID}";`],
    ['a UUID without any exa name', `id: ${UUID}`],
  ];
  for (const [name, text] of negatives) {
    it(`is not reported for ${name}`, () => {
      const result = scanContent(`${text}\n`);
      assert.equal(result.status, 0, result.output);
    });
  }
});

describe('service-role JWTs', () => {
  const header = Buffer.from('{"alg":"none"}').toString('base64url');
  const jwt = (payload) => `${header}.${Buffer.from(payload).toString('base64url')}.FAKE-SIGNATURE-NOT-REAL`;

  it('a payload with role service_role is found, whatever the spacing', () => {
    for (const payload of ['{"role":"service_role"}', '{"iss":"x", "role" : "service_role"}']) {
      const result = scanContent(`token=${jwt(payload)}\n`);
      assert.equal(result.status, 1, result.output);
      assert.ok(result.stderr.includes('supabase-service-role-jwt'), result.output);
    }
  });

  it('other roles and undecodable payloads are not found', () => {
    for (const text of [jwt('{"role":"anon"}'), jwt('{"role":"authenticated"}'), `${header}.eyJ!!!.sig`]) {
      const result = scanContent(`${text}\n`);
      assert.equal(result.status, 0, `${text}\n${result.output}`);
    }
  });
});

describe('scanning behaviour', () => {
  it('reports each match with its own line number', () => {
    const result = scanContent(
      [
        'first line is fine',
        'a=gsk_FAKEFIXTURENOTAREALKEY0000000000',
        'fine',
        'b=sb_secret_FAKE_FIXTURE_NOT_A_REAL_KEY',
      ].join('\n'),
    );
    assert.equal(result.status, 1, result.output);
    assert.ok(result.stderr.includes(`${result.file}:2`), result.output);
    assert.ok(result.stderr.includes(`${result.file}:4`), result.output);
  });

  it('reports two matches on the same line', () => {
    const result = scanContent(
      'x=gsk_FAKEFIXTURENOTAREALKEY0000000000 y=sb_secret_FAKE_FIXTURE_NOT_A_REAL_KEY\n',
    );
    assert.equal(result.status, 1, result.output);
    assert.ok(result.stderr.includes('groq-api-key'), result.output);
    assert.ok(result.stderr.includes('supabase-secret-key'), result.output);
  });

  it('finds a key at the end of a multi-megabyte single line', () => {
    const result = scanContent(`${'a'.repeat(3_000_000)} gsk_FAKEFIXTURENOTAREALKEY0000000000`);
    assert.equal(result.status, 1, result.output);
    assert.ok(result.stderr.includes(`${result.file}:1`), result.output);
  });

  it('looks inside files that contain binary bytes', () => {
    const result = scanContent(
      Buffer.concat([Buffer.from([0, 1, 2, 255]), Buffer.from(' gsk_FAKEFIXTURENOTAREALKEY0000000000')]),
      'blob.bin',
    );
    assert.equal(result.status, 1, result.output);
    assert.ok(result.stderr.includes(`${result.file}:1`), result.output);
    assert.ok(result.stderr.includes('groq-api-key'), result.output);
  });

  it('accepts several paths, files and folders mixed', () => {
    const result = run(cleanDir, planted('groq-key.txt'), planted('nested'));
    assert.equal(result.status, 1, result.output);
    assert.ok(result.stderr.includes('groq-key.txt:2'), result.output);
    assert.ok(result.stderr.includes('bundle.min.txt:1'), result.output);
    assert.ok(!result.stderr.includes('sb-secret.txt'), result.output);
  });

  it('does not follow symbolic links below an argument, and says so', () => {
    const dir = join(scratch, 'with-link');
    mkdirSync(dir);
    writeFileSync(join(dir, 'ok.txt'), 'nothing to see\n');
    symlinkSync(plantedDir, join(dir, 'link'));
    const result = run(dir);
    assert.equal(result.status, 0, result.output);
    assert.match(result.stderr, /skipped symbolic link/);
    assert.ok(!result.stderr.includes('groq-api-key'), result.output);
  });
});

describe('usage errors', () => {
  it('no arguments exits 2 with usage', () => {
    const result = run();
    assert.equal(result.status, 2, result.output);
    assert.match(result.stderr, /usage/i);
  });

  it('a path that does not exist exits 2 instead of passing silently', () => {
    const missing = join(scratch, 'does-not-exist', 'dist');
    const result = run(missing);
    assert.equal(result.status, 2, result.output);
    assert.ok(result.stderr.includes(missing), result.output);
  });

  it('a folder with no files in it exits 2, because nothing was checked', () => {
    const dir = join(scratch, 'empty');
    mkdirSync(join(dir, 'sub'), { recursive: true });
    const result = run(dir);
    assert.equal(result.status, 2, result.output);
    assert.match(result.stderr, /no files to scan/);
  });

  it('an unexpanded glob (no matching folders) exits 2', () => {
    const result = run('apps/*/no-such-output');
    assert.equal(result.status, 2, result.output);
  });
});
