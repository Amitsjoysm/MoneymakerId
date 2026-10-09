import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { commandNameFromFile, formatHelp, isEntryPoint, listCommandFiles, loadCommand, main } from './cli.ts';

const CLI_PATH = fileURLToPath(new URL('./cli.ts', import.meta.url));
const CLI_URL = pathToFileURL(CLI_PATH).href;

describe('commandNameFromFile', () => {
  it('replaces only the first dash with a colon', () => {
    expect(commandNameFromFile('import-csv.ts')).toBe('import:csv');
    expect(commandNameFromFile('import-reference.ts')).toBe('import:reference');
    expect(commandNameFromFile('a-b-c.ts')).toBe('a:b-c');
  });

  it('keeps a name without a dash as it is', () => {
    expect(commandNameFromFile('rank.ts')).toBe('rank');
  });

  it('ignores test files, declaration files, hidden files and other extensions', () => {
    expect(commandNameFromFile('rank.test.ts')).toBeNull();
    expect(commandNameFromFile('import-csv.test.ts')).toBeNull();
    expect(commandNameFromFile('rank.d.ts')).toBeNull();
    expect(commandNameFromFile('.hidden.ts')).toBeNull();
    expect(commandNameFromFile('README.md')).toBeNull();
    expect(commandNameFromFile('rank.js')).toBeNull();
  });
});

describe('formatHelp', () => {
  it('says "no commands yet" when there are none', () => {
    expect(formatHelp([])).toContain('no commands yet');
  });

  it('lists each command with its description', () => {
    const help = formatHelp([
      { name: 'import:csv', description: 'Import a CSV' },
      { name: 'rank', description: 'Rank things' },
    ]);
    expect(help).toContain('import:csv');
    expect(help).toContain('Import a CSV');
    expect(help).toContain('rank');
    expect(help).not.toContain('no commands yet');
  });
});

describe('isEntryPoint', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mm-entry-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('is true when argv[1] is the module file itself', () => {
    expect(isEntryPoint(CLI_PATH, CLI_URL)).toBe(true);
  });

  it('is true when argv[1] is a symlink to the module file, as with a bin shim', async () => {
    const link = join(dir, 'mm');
    await symlink(CLI_PATH, link);
    expect(isEntryPoint(link, CLI_URL)).toBe(true);
  });

  it('is false for another file, a missing file and no argv[1]', async () => {
    const other = join(dir, 'other.ts');
    await writeFile(other, 'export {};\n');
    expect(isEntryPoint(other, CLI_URL)).toBe(false);
    expect(isEntryPoint(join(dir, 'missing.ts'), CLI_URL)).toBe(false);
    expect(isEntryPoint(undefined, CLI_URL)).toBe(false);
  });
});

describe('running as a script', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mm-bin-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const runWith = (entry: string) =>
    spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8', env: { ...process.env } });

  it('prints help when started directly', () => {
    const result = runWith(CLI_PATH);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: mm');
  });

  it('prints help when started through a symlink (a bin shim must not silently do nothing)', async () => {
    const link = join(dir, 'mm');
    await symlink(CLI_PATH, link);
    const result = runWith(link);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: mm');
  });
});

describe('discovery and dispatch', () => {
  let dir: string;
  const out: string[] = [];
  const err: string[] = [];
  const io = { out: (s: string) => out.push(s), err: (s: string) => err.push(s) };

  beforeEach(async () => {
    out.length = 0;
    err.length = 0;
    dir = await mkdtemp(join(tmpdir(), 'mm-cli-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // A command module whose exit code is the given expression, so tests can see what run() received.
  const writeCommand = (file: string, description: string, exitCode = '0') =>
    writeFile(
      join(dir, file),
      `export const description = ${JSON.stringify(description)};\n` +
        `export async function run(args: string[]): Promise<number> {\n  return ${exitCode};\n}\n`,
    );
  // A module that cannot even be imported.
  const writeBrokenCommand = (file: string) => writeFile(join(dir, file), 'export const = ;\n');

  it('treats an empty or missing directory as no commands', async () => {
    expect(await listCommandFiles(dir)).toEqual([]);
    expect(await listCommandFiles(join(dir, 'missing'))).toEqual([]);
  });

  it('lists command files by name, sorted, skipping test files and folders, without importing them', async () => {
    await writeCommand('rank.ts', 'Rank things');
    await writeBrokenCommand('import-csv.ts');
    await writeCommand('rank.test.ts', 'not a command');
    await mkdir(join(dir, 'nested'));
    expect(await listCommandFiles(dir)).toEqual([
      { name: 'import:csv', file: 'import-csv.ts' },
      { name: 'rank', file: 'rank.ts' },
    ]);
  });

  it('loads a command module', async () => {
    await writeCommand('rank.ts', 'Rank things', '5');
    const command = await loadCommand(dir, { name: 'rank', file: 'rank.ts' });
    expect(command.description).toBe('Rank things');
    expect(await command.run([])).toBe(5);
  });

  it('rejects a command module that does not export description and run', async () => {
    await writeFile(join(dir, 'broken.ts'), 'export const description = 1;\n');
    await expect(loadCommand(dir, { name: 'broken', file: 'broken.ts' })).rejects.toThrow(/broken\.ts/);
  });

  it('prints help and exits 0 for --help, -h, help and no arguments', async () => {
    for (const argv of [['--help'], ['-h'], ['help'], []]) {
      out.length = 0;
      expect(await main(argv, { dir, ...io })).toBe(0);
      expect(out.join('\n')).toContain('no commands yet');
    }
  });

  it('lists the discovered commands in help', async () => {
    await writeCommand('import-csv.ts', 'Import a CSV');
    expect(await main(['--help'], { dir, ...io })).toBe(0);
    expect(out.join('\n')).toContain('import:csv');
    expect(out.join('\n')).toContain('Import a CSV');
  });

  it('still prints help when one command cannot be loaded, and marks it', async () => {
    await writeCommand('rank.ts', 'Rank things');
    await writeBrokenCommand('import-csv.ts');
    expect(await main(['--help'], { dir, ...io })).toBe(0);
    expect(out.join('\n')).toContain('Rank things');
    expect(out.join('\n')).toMatch(/import:csv\s+\(cannot load/);
  });

  it('runs the named command with the remaining arguments and returns its exit code', async () => {
    // This command exits with the number of arguments it received.
    await writeCommand('import-csv.ts', 'Import a CSV', 'args.length');
    expect(await main(['import:csv', 'file.csv', '--dry-run'], { dir, ...io })).toBe(2);
    expect(await main(['import:csv'], { dir, ...io })).toBe(0);
  });

  it('does not load other commands when running one', async () => {
    await writeCommand('rank.ts', 'Rank things', '4');
    await writeBrokenCommand('import-csv.ts');
    expect(await main(['rank'], { dir, ...io })).toBe(4);
    expect(err).toEqual([]);
  });

  it('exits 1 and prints the message when a command throws', async () => {
    await writeCommand('rank.ts', 'Rank things', "(() => { throw new Error('boom'); })()");
    expect(await main(['rank'], { dir, ...io })).toBe(1);
    expect(err.join('\n')).toContain('boom');
  });

  it('prints only the message, not a stack, when a command throws and MM_DEBUG is not set', async () => {
    await writeCommand('rank.ts', 'Rank things', "(() => { throw new Error('boom'); })()");
    expect(await main(['rank'], { dir, ...io, env: {} })).toBe(1);
    expect(err.join('\n')).toBe('mm rank: boom');
    expect(await main(['rank'], { dir, ...io, env: { MM_DEBUG: '0' } })).toBe(1);
    expect(err.at(-1)).toBe('mm rank: boom');
  });

  it('prints the error stack when a command throws and MM_DEBUG=1', async () => {
    await writeCommand('rank.ts', 'Rank things', "(() => { throw new Error('boom'); })()");
    expect(await main(['rank'], { dir, ...io, env: { MM_DEBUG: '1' } })).toBe(1);
    const text = err.join('\n');
    expect(text).toContain('mm rank: Error: boom');
    expect(text).toMatch(/\n\s+at .*rank\.ts/);
  });

  it('prints the underlying cause too under MM_DEBUG=1 when a command cannot be loaded', async () => {
    await writeBrokenCommand('import-csv.ts');
    expect(await main(['import:csv'], { dir, ...io, env: { MM_DEBUG: '1' } })).toBe(1);
    expect(err.join('\n')).toMatch(/Caused by: \w*Error/);
  });

  it('exits 1 and names the file when the requested command cannot be loaded', async () => {
    await writeBrokenCommand('import-csv.ts');
    expect(await main(['import:csv'], { dir, ...io })).toBe(1);
    expect(err.join('\n')).toContain('import:csv');
  });

  it('exits 2 and names the command and the known commands for an unknown command', async () => {
    await writeCommand('rank.ts', 'Rank things');
    expect(await main(['nope'], { dir, ...io })).toBe(2);
    expect(err.join('\n')).toContain('nope');
    expect(err.join('\n')).toContain('rank');
  });
});
