import { ConfigError } from './errors.ts';

interface Row {
  cells: string[];
  /** 1-based line where the row starts. */
  line: number;
}

function parseRows(text: string): Row[] {
  const src = text.startsWith('﻿') ? text.slice(1) : text;
  const rows: Row[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false; // inside a quoted cell
  let wasQuoted = false; // the current cell started with a quote
  let line = 1;
  let rowLine = 1;

  const endCell = () => {
    cells.push(cell);
    cell = '';
    wasQuoted = false;
  };
  const endRow = () => {
    endCell();
    const blank = cells.length === 1 && cells[0] === '' && !wasQuoted;
    if (!blank) rows.push({ cells, line: rowLine });
    cells = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '' && !wasQuoted) {
      quoted = true;
      wasQuoted = true;
    } else if (ch === ',') {
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new ConfigError(`CSV: unterminated quoted cell starting on line ${rowLine}`);
  if (cell !== '' || cells.length > 0 || wasQuoted) endRow();
  return rows;
}

/** Parses RFC 4180 CSV (quoted cells, `""` escapes, CRLF or LF, optional BOM). Blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  return parseRows(text).map((r) => r.cells);
}

export interface CsvRecord {
  /** 1-based line where the record starts, for error messages. */
  line: number;
  values: Record<string, string>;
}

/** Parses CSV with a header row. A row with the wrong number of cells is an error that names its line. */
export function parseCsvRecords(text: string): { header: string[]; records: CsvRecord[] } {
  const [head, ...rest] = parseRows(text);
  if (!head) throw new ConfigError('CSV: the file is empty (no header row)');
  const header = head.cells;
  const records = rest.map((row) => {
    if (row.cells.length !== header.length) {
      throw new ConfigError(`CSV: line ${row.line} has ${row.cells.length} cells, expected ${header.length}`);
    }
    return { line: row.line, values: Object.fromEntries(header.map((h, i) => [h, row.cells[i]!])) };
  });
  return { header, records };
}
