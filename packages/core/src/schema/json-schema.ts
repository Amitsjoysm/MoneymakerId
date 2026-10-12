// JSON-schema export for the LLM-facing schemas, in the subset Groq's strict structured-output mode accepts.
//
// Strict mode needs three things of every object: all properties listed in `required`, `additionalProperties:
// false`, and optional data written as a null union. `toStrictJsonSchema` exports a Zod schema through Zod's
// own `z.toJSONSchema` and trims the result to the keywords strict mode understands. `strictSchemaViolations`
// checks an exported schema against those three rules; the tests run it over every LLM schema.
//
// Three kinds of keyword are handled differently on the way out:
//   - Value constraints (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `pattern`, `format`,
//     `minLength`, `maxLength`, `minItems`, `maxItems`) and annotations (`$schema`, `title`, `default`,
//     `examples`) are dropped silently. Strict mode rejects them, and the Zod schema still enforces the
//     constraints when the model's reply is parsed.
//   - `const` is rewritten as a one-value `enum`, so a literal keeps its meaning.
//   - `$ref`, `$defs`, `oneOf`, `allOf` and `not` change what the schema accepts, and strict mode does not
//     support them, so dropping them would silently loosen the schema. `toStrictJsonSchema` throws instead,
//     naming the JSON pointer and the keyword.
import { z } from 'zod';

export type JsonSchema = Record<string, unknown>;

/** The only keywords that survive the export. */
export const STRICT_KEYWORDS: ReadonlySet<string> = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'description',
  'anyOf',
]);

/** Keywords whose removal would change what the schema accepts: the export throws rather than drop them. */
export const REJECTED_KEYWORDS: readonly string[] = ['$ref', '$defs', 'oneOf', 'allOf', 'not'];

function isRecord(v: unknown): v is JsonSchema {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `anyOf: [X, { type: 'null' }]` becomes `X` with `type: [X.type, 'null']` (and `null` added to an `enum`). */
function collapseNullable(node: JsonSchema): JsonSchema {
  const branches = node['anyOf'];
  if (!Array.isArray(branches) || branches.length !== 2) return node;
  const nullAt = branches.findIndex(
    (b) => isRecord(b) && b['type'] === 'null' && Object.keys(b).length === 1,
  );
  if (nullAt === -1) return node;
  const other: unknown = branches[1 - nullAt];
  if (!isRecord(other) || typeof other['type'] !== 'string') return node;
  const { anyOf: _anyOf, ...rest } = node;
  const merged: JsonSchema = { ...rest, ...other, type: [other['type'], 'null'] };
  if (Array.isArray(other['enum'])) merged['enum'] = [...other['enum'], null];
  return merged;
}

function trimValue(value: unknown, path: string): unknown {
  return Array.isArray(value) ? value.map((item, i) => trim(item, `${path}/${i}`)) : trim(value, path);
}

/** `path` is the JSON pointer of `node` in the exported schema (empty for the root), for error messages. */
function trim(node: unknown, path: string): unknown {
  if (!isRecord(node)) return node;
  for (const keyword of REJECTED_KEYWORDS) {
    if (keyword in node) {
      throw new Error(
        `${path || '#'}: "${keyword}" cannot be exported to strict mode, and dropping it would change what the schema accepts`,
      );
    }
  }
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) {
    if (!STRICT_KEYWORDS.has(key)) continue;
    if (key === 'properties' && isRecord(value)) {
      out[key] = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, trim(child, `${path}/properties/${name}`)]),
      );
    } else if (key === 'enum') {
      out[key] = value;
    } else {
      out[key] = trimValue(value, `${path}/${key}`);
    }
  }
  if ('const' in node) out['enum'] = [node['const']];
  return collapseNullable(out);
}

/** Exports a Zod schema as strict-mode JSON schema. Does not repair violations: see `strictSchemaViolations`. */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  return trim(z.toJSONSchema(schema, { io: 'output' }), '') as JsonSchema;
}

function typesOf(node: JsonSchema): string[] {
  const t = node['type'];
  return Array.isArray(t)
    ? t.filter((x): x is string => typeof x === 'string')
    : typeof t === 'string'
      ? [t]
      : [];
}

/**
 * Checks the three strict-mode rules on every object in `json`, recursing through `properties`, `items` and
 * `anyOf`. Returns one message per violation, each starting with the JSON pointer of the offending node
 * (an empty list means the schema is strict).
 */
export function strictSchemaViolations(json: unknown): string[] {
  const violations: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (!isRecord(node)) return;
    const properties = node['properties'];
    if (typesOf(node).includes('object') || isRecord(properties)) {
      const names = isRecord(properties) ? Object.keys(properties) : [];
      const required = Array.isArray(node['required']) ? node['required'] : [];
      if (node['additionalProperties'] !== false) {
        violations.push(`${path || '#'}: additionalProperties must be false`);
      }
      for (const name of names) {
        if (!required.includes(name)) {
          violations.push(
            `${path || '#'}: property "${name}" must be listed in required (optional means nullable)`,
          );
        }
      }
      for (const name of required) {
        if (typeof name === 'string' && !names.includes(name)) {
          violations.push(`${path || '#'}: required lists "${name}", which is not a property`);
        }
      }
      for (const [name, child] of Object.entries(isRecord(properties) ? properties : {})) {
        walk(child, `${path}/properties/${name}`);
      }
    }
    if (node['items'] !== undefined) walk(node['items'], `${path}/items`);
    if (Array.isArray(node['anyOf']))
      node['anyOf'].forEach((branch, i) => walk(branch, `${path}/anyOf/${i}`));
    for (const key of REJECTED_KEYWORDS) {
      if (key in node) violations.push(`${path || '#'}: "${key}" is not supported in strict mode`);
    }
  };
  walk(json, '');
  return violations;
}
