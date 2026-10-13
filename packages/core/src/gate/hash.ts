// Canonical JSON and the content hash (CONTRACTS §6: `content_hash` = sha256 of the canonical JSON of a page's
// data inputs, not of its HTML). Web Crypto only, so it runs unchanged in Node and in Workers.

/**
 * JSON with object keys sorted (recursively, by UTF-16 code unit) and no whitespace, so equal data always
 * serialises to the same text. Array order is kept. Follows `JSON.stringify` for `undefined` (dropped from an
 * object, `null` in an array) and for `toJSON`. It throws instead of guessing for what JSON cannot hold
 * (non-finite numbers, bigint, functions, symbols, Map/Set/class instances) and for cycles, because a lossy
 * serialisation could make two different inputs hash alike.
 */
export function canonicalJson(value: unknown): string {
  return write(value, []);
}

function write(value: unknown, ancestors: object[]): string {
  if (value === null || value === undefined) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: ${value} is not a finite number`);
      return JSON.stringify(value);
    case 'object':
      return writeObject(value, ancestors);
    default:
      throw new TypeError(`canonicalJson: a ${typeof value} has no JSON form`);
  }
}

function writeObject(value: object, ancestors: object[]): string {
  if (ancestors.includes(value)) throw new TypeError('canonicalJson: the value contains a cycle');
  const toJSON = (value as { toJSON?: unknown }).toJSON;
  if (typeof toJSON === 'function') return write(toJSON.call(value), [...ancestors, value]);
  const next = [...ancestors, value];
  if (Array.isArray(value)) return `[${value.map((item) => write(item, next)).join(',')}]`;
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError('canonicalJson: only plain objects and arrays can be hashed');
  }
  const record = value as Record<string, unknown>;
  const members: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const member = record[key];
    if (member === undefined) continue;
    members.push(`${JSON.stringify(key)}:${write(member, next)}`);
  }
  return `{${members.join(',')}}`;
}

/** Lowercase hex SHA-256 of the UTF-8 bytes of `text`. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** `sha256Hex(canonicalJson(value))`: the `content_hash` of a page's data inputs. */
export async function contentHash(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}
