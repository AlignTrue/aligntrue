type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * Deterministic JSON stringify with sorted object keys and no whitespace.
 */
export function canonicalize(value: JSONValue): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: JSONValue): JSONValue {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  const sortedKeys = Object.keys(value).sort();
  const result: { [key: string]: JSONValue } = {};
  for (const key of sortedKeys) {
    const child = (value as Record<string, JSONValue | undefined>)[key];
    if (child === undefined) continue;
    result[key] = normalize(child);
  }
  return result;
}
