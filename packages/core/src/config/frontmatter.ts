// A deliberately small YAML front-matter reader for content/locality-guides/*.md.
//
// There is no YAML dependency in the workspace and T01 may not add one, so this reads the subset the guides
// use: `key: value` pairs, block lists of scalars or of mappings, and scalars (double-quoted, single-quoted
// or plain, plus numbers, booleans and null). Anything else (flow collections, block scalars, anchors, tags,
// duplicate keys, tabs) is an error rather than a guess. If front matter ever needs more, add `yaml` to the
// workspace catalog and replace this file.
import { ConfigError } from './errors.ts';

export interface Frontmatter {
  data: Record<string, unknown>;
  /** Everything after the closing `---`, untouched. */
  body: string;
}

interface Line {
  indent: number;
  text: string;
  no: number;
}

const KEY_LINE = /^([A-Za-z0-9_][A-Za-z0-9_-]*):(?: +(.*))?$/;

function fail(no: number, message: string): never {
  throw new ConfigError(`front matter, line ${no}: ${message}`);
}

function parseDoubleQuoted(raw: string, no: number): { value: string; rest: string } {
  let out = '';
  for (let i = 1; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === '"') return { value: out, rest: raw.slice(i + 1) };
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const esc = raw[++i];
    const simple: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
    if (esc !== undefined && esc in simple) out += simple[esc];
    else if (esc === 'u' && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 1, i + 5))) {
      out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 5), 16));
      i += 4;
    } else fail(no, `unsupported escape "\\${esc ?? ''}"`);
  }
  return fail(no, 'unterminated double-quoted string');
}

function parseSingleQuoted(raw: string, no: number): { value: string; rest: string } {
  let out = '';
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] === "'") {
      if (raw[i + 1] === "'") {
        out += "'";
        i++;
      } else return { value: out, rest: raw.slice(i + 1) };
    } else out += raw[i];
  }
  return fail(no, 'unterminated single-quoted string');
}

function assertOnlyComment(rest: string, no: number): void {
  const t = rest.trim();
  if (t !== '' && !t.startsWith('#')) fail(no, `unexpected text after a quoted string: ${t}`);
}

function parseScalar(raw: string, no: number): unknown {
  const text = raw.trim();
  if (text.startsWith('"')) {
    const { value, rest } = parseDoubleQuoted(text, no);
    assertOnlyComment(rest, no);
    return value;
  }
  if (text.startsWith("'")) {
    const { value, rest } = parseSingleQuoted(text, no);
    assertOnlyComment(rest, no);
    return value;
  }
  const plain = text.replace(/\s+#.*$/, '').trim();
  if (plain === '[]') return [];
  if (/^[[\]{}|>&*!%@`]/.test(plain)) fail(no, `unsupported YAML syntax: ${plain}`);
  if (plain.includes(': ') || plain.endsWith(':')) fail(no, `a plain value may not contain ": " (quote it): ${plain}`);
  if (plain === '' || plain === '~' || /^(null|Null|NULL)$/.test(plain)) return null;
  if (/^(true|True|TRUE)$/.test(plain)) return true;
  if (/^(false|False|FALSE)$/.test(plain)) return false;
  if (/^-?(0|[1-9]\d*)$/.test(plain)) return Number(plain);
  if (/^-?(0|[1-9]\d*)\.\d+$/.test(plain)) return Number(plain);
  return plain;
}

function parseMapping(lines: Line[], start: number, indent: number): { value: Record<string, unknown>; next: number } {
  const out: Record<string, unknown> = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.indent < indent) break;
    if (line.indent > indent) fail(line.no, 'unexpected indentation');
    if (line.text.startsWith('- ') || line.text === '-') break;
    const m = KEY_LINE.exec(line.text);
    if (!m) fail(line.no, `expected "key: value", got: ${line.text}`);
    const key = m[1]!;
    if (key in out) fail(line.no, `duplicate key "${key}"`);
    const rest = m[2];
    i++;
    if (rest !== undefined && rest.trim() !== '' && !rest.trim().startsWith('#')) {
      out[key] = parseScalar(rest, line.no);
      continue;
    }
    const nextLine = lines[i];
    const nested =
      nextLine !== undefined &&
      (nextLine.indent > indent || (nextLine.indent === indent && nextLine.text.startsWith('- ')));
    if (!nested) {
      out[key] = null;
      continue;
    }
    const block = parseBlock(lines, i, nextLine.indent);
    out[key] = block.value;
    i = block.next;
  }
  return { value: out, next: i };
}

function parseSequence(lines: Line[], start: number, indent: number): { value: unknown[]; next: number } {
  const out: unknown[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.indent !== indent || !(line.text.startsWith('- ') || line.text === '-')) break;
    const afterDash = line.text.slice(1);
    const rest = afterDash.trimStart();
    const offset = 1 + (afterDash.length - rest.length);
    if (rest === '') {
      const nextLine = lines[i + 1];
      if (!nextLine || nextLine.indent <= indent) {
        out.push(null);
        i++;
      } else {
        const block = parseBlock(lines, i + 1, nextLine.indent);
        out.push(block.value);
        i = block.next;
      }
    } else if (KEY_LINE.test(rest)) {
      // A mapping whose first pair shares the dash's line: re-read this line with the dash blanked out.
      lines[i] = { indent: indent + offset, text: rest, no: line.no };
      const block = parseMapping(lines, i, indent + offset);
      out.push(block.value);
      i = block.next;
    } else {
      out.push(parseScalar(rest, line.no));
      i++;
    }
  }
  return { value: out, next: i };
}

function parseBlock(lines: Line[], start: number, indent: number): { value: unknown; next: number } {
  const first = lines[start]!;
  return first.text.startsWith('- ') || first.text === '-'
    ? parseSequence(lines, start, indent)
    : parseMapping(lines, start, indent);
}

/** Splits a markdown file into its front matter (parsed) and body. Throws `ConfigError` on anything unsupported. */
export function parseFrontmatter(text: string): Frontmatter {
  const src = text.replace(/^\uFEFF/, '');
  const open = /^---[ \t]*\r?\n/.exec(src);
  if (!open) throw new ConfigError('front matter is missing: the file must start with a "---" line');
  const afterOpen = src.slice(open[0].length);
  const close = /^---[ \t]*(?:\r?\n|$)/m.exec(afterOpen);
  if (!close) throw new ConfigError('front matter has no closing "---" line');
  const block = afterOpen.slice(0, close.index);
  const body = afterOpen.slice(close.index + close[0].length);

  const lines: Line[] = [];
  block.split(/\r?\n/).forEach((raw, idx) => {
    const no = idx + 2; // the opening --- is line 1
    if (/^\s*(#.*)?$/.test(raw)) return;
    if (/^ *\t/.test(raw)) fail(no, 'tabs are not allowed for indentation');
    const trimmed = raw.trimStart();
    lines.push({ indent: raw.length - trimmed.length, text: trimmed.trimEnd(), no });
  });
  if (lines.length === 0) return { data: {}, body };
  const first = lines[0]!;
  if (first.text.startsWith('- ')) fail(first.no, 'the front matter must be a mapping');
  const { value, next } = parseMapping(lines, 0, first.indent);
  if (next < lines.length) fail(lines[next]!.no, 'unexpected content');
  return { data: value, body };
}
