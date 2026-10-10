import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRepoRoot } from './repo-root.ts';

describe('findRepoRoot', () => {
  it('finds the real repository root from the current directory', () => {
    const root = findRepoRoot();
    expect(realpathSync(join(root, 'pnpm-workspace.yaml'))).toBeTruthy();
    expect(realpathSync(join(root, 'data'))).toBeTruthy();
  });

  it('walks up from a nested directory to the nearest pnpm-workspace.yaml', () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'mm-root-')));
    try {
      writeFileSync(join(base, 'pnpm-workspace.yaml'), 'packages: []\n');
      const nested = join(base, 'a', 'b', 'c');
      mkdirSync(nested, { recursive: true });
      expect(findRepoRoot(nested)).toBe(base);
      // A closer workspace file wins.
      writeFileSync(join(base, 'a', 'pnpm-workspace.yaml'), 'packages: []\n');
      expect(findRepoRoot(nested)).toBe(join(base, 'a'));
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('throws a clear error when no workspace file exists above the start directory', () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'mm-noroot-')));
    try {
      expect(() => findRepoRoot(base)).toThrow(/pnpm-workspace\.yaml/);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
