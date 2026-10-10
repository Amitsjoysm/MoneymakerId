import { describe, expect, it } from 'vitest';
import { ConfigError } from './errors.ts';
import { parseCsv, parseCsvRecords } from './csv.ts';

describe('parseCsv', () => {
  it('splits rows and cells', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps empty cells, including a trailing one', () => {
    expect(parseCsv('a,,c,\n')).toEqual([['a', '', 'c', '']]);
  });

  it('handles quoted cells with commas, escaped quotes and newlines', () => {
    expect(parseCsv('a,"b, c","say ""hi""","line1\nline2"\n')).toEqual([['a', 'b, c', 'say "hi"', 'line1\nline2']]);
  });

  it('handles CRLF, a missing final newline and a leading BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a\n\nb\n')).toEqual([['a'], ['b']]);
  });

  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a,"oops\n')).toThrow(ConfigError);
  });
});

describe('parseCsvRecords', () => {
  it('keys cells by header and reports 1-based line numbers', () => {
    const { header, records } = parseCsvRecords('x,y\n1,2\n3,4\n');
    expect(header).toEqual(['x', 'y']);
    expect(records).toEqual([
      { line: 2, values: { x: '1', y: '2' } },
      { line: 3, values: { x: '3', y: '4' } },
    ]);
  });

  it('rejects a row with the wrong number of cells, naming the line', () => {
    expect(() => parseCsvRecords('x,y\n1,2,3\n')).toThrow(/line 2/);
  });

  it('rejects an empty file', () => {
    expect(() => parseCsvRecords('')).toThrow(ConfigError);
  });
});
