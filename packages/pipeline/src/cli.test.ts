import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { commandNameFromFile, formatHelp, listCommandFiles, loadCommand, main } from './cli.ts';

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
