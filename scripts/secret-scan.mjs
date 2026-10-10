#!/usr/bin/env node
// Fails when a build output holds something shaped like one of our credentials (plan §17).
// Usage: node scripts/secret-scan.mjs <file-or-folder>...
//
// Exit 0: nothing found. Exit 1: at least one secret-shaped string; every one is listed as file:line with
// the value masked. Exit 2: wrong usage, a path that cannot be read, or no files at all to scan. A scan that
// read nothing must never look like a pass, so an unexpanded `apps/*/dist` glob fails instead of succeeding.
//
// Every file is scanned, binary or not, and symbolic links below an argument are not followed.
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

// `reveal` is how many leading characters may be printed: only a prefix that is public. The text after it is
// never printed.
const rules = [
  { id: 'supabase-secret-key', pattern: /sb_secret_[A-Za-z0-9_-]{10,}/g, reveal: 10 },
  { id: 'groq-api-key', pattern: /gsk_[A-Za-z0-9]{20,}/g, reveal: 4 },
  { id: 'firecrawl-api-key', pattern: /fc-[a-f0-9]{24,}/g, reveal: 3 },
  {
    // A UUID (or a `label:uuid,label:uuid` pool, CONTRACTS §10) assigned to a variable or property whose name
    // contains `exa` as a word of its own: EXA_API_KEYS, exaApiKey, exa-key. Names such as example_id, EXACT_ID
    // or hexagon do not count, so ordinary UUIDs are left alone.
    id: 'exa-api-key',
    pattern: new RegExp(
      '(?:(?<![A-Za-z0-9])(?:exa(?![a-z])|EXA(?![A-Za-z]))|Exa(?![a-z]))' +
        '[\\w.-]*["\']?[ \\t]*[:=][ \\t]*["\']?' +
        `((?:[\\w-]+:)?${UUID}(?:,(?:[\\w-]+:)?${UUID})*)`,
      'g',
    ),
    group: 1,
    reveal: 0,
  },
  { id: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g, reveal: Infinity },
  {
    // Only a token whose payload says role = service_role: the public anon and authenticated keys are fine.
    id: 'supabase-service-role-jwt',
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
    reveal: 3,
    accept: (token) =>
      /"role"\s*:\s*"service_role"/.test(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')),
  },
];

function mask(value, reveal) {
  if (reveal >= value.length) return value;
  return `${value.slice(0, reveal)}********(${value.length} chars)`;
}

// Returns a function that turns a character index of `text` into a 1-based line number.
function lineNumbers(text) {
  let starts;
  return (index) => {
    if (!starts) {
      starts = [0];
      for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
    }
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= index) low = middle;
      else high = middle - 1;
    }
    return low + 1;
  };
}

function scanText(text) {
  const lineOf = lineNumbers(text);
  const found = [];
  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      const value = match[rule.group ?? 0];
      if (rule.accept && !rule.accept(value)) continue;
      found.push({
        rule: rule.id,
        line: lineOf(match.index),
        column: match.index,
        shown: mask(value, rule.reveal),
      });
    }
  }
  return found.sort((a, b) => a.line - b.line || a.column - b.column);
}

// Lists the files under `path`. Symbolic links met while walking are skipped, not followed.
function collectFiles(path, files, notes, errors, isArgument = true) {
  let stat;
  try {
    stat = isArgument ? statSync(path) : lstatSync(path);
    if (stat.isSymbolicLink()) {
      notes.push(`skipped symbolic link ${path}`);
    } else if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort())
        collectFiles(join(path, name), files, notes, errors, false);
    } else if (stat.isFile()) {
      files.push(path);
    }
  } catch (error) {
    errors.push(`cannot read ${path}: ${error.code ?? error.message}`);
  }
}

function main(paths) {
  if (paths.length === 0) {
    console.error('usage: node scripts/secret-scan.mjs <file-or-folder>...');
    return 2;
  }

  const files = [];
  const notes = [];
  const errors = [];
  for (const path of paths) collectFiles(path, files, notes, errors);

  const findings = [];
  for (const file of files) {
    try {
      // latin1 maps every byte to one character, so binary files are scanned without decoding errors.
      for (const finding of scanText(readFileSync(file, 'latin1'))) findings.push({ file, ...finding });
    } catch (error) {
      errors.push(`cannot read ${file}: ${error.code ?? error.message}`);
    }
  }

  for (const note of notes) console.error(`secret-scan: ${note}`);
  for (const error of errors) console.error(`secret-scan: ${error}`);

  if (findings.length > 0) {
    console.error(`secret-scan: ${findings.length} possible secret(s) found`);
    for (const { file, line, rule, shown } of findings) console.error(`  ${file}:${line}  ${rule}  ${shown}`);
    console.error('Remove the value from the build and rotate it if it was ever committed or deployed.');
    return 1;
  }
  if (errors.length > 0) return 2;
  if (files.length === 0) {
    console.error('secret-scan: no files to scan, so nothing was checked');
    return 2;
  }
  console.log(`secret-scan: no secrets found in ${files.length} file(s)`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
