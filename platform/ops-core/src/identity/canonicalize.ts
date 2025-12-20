type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * Deterministic JSON stringify with sorted object keys and no whitespace.
 * Accepts unknown and coerces to JSONValue, throwing on unsupported types.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(toJSONValue(value)));
}

function toJSONValue(value: unknown): JSONValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => toJSONValue(v));
  }

  if (typeof value === "object") {
    const result: { [key: string]: JSONValue } = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (child === undefined) continue;
      result[key] = toJSONValue(child);
    }
    return result;
  }

  throw new TypeError("Value cannot be canonicalized to JSON");
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
