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
    const result: { [key: string]: JSONValue } = Object.create(null);
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (child === undefined) continue;
      assertSafeKey(key);
      // Use defineProperty to avoid potential property injection alerts
      Object.defineProperty(result, key, {
        value: toJSONValue(child),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  }

  throw new TypeError("Value cannot be canonicalized to JSON");
}

function assertSafeKey(key: string): void {
  if (
    key === "__proto__" ||
    key === "prototype" ||
    key === "constructor" ||
    key === "__defineGetter__" ||
    key === "__defineSetter__" ||
    key === "__lookupGetter__" ||
    key === "__lookupSetter__"
  ) {
    throw new TypeError(`Refusing to canonicalize unsafe object key: ${key}`);
  }
}

function normalize(value: JSONValue): JSONValue {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  const sortedKeys = Object.keys(value).sort();
  const result: { [key: string]: JSONValue } = Object.create(null);
  for (const key of sortedKeys) {
    const child = (value as Record<string, JSONValue | undefined>)[key];
    if (child === undefined) continue;
    // Use defineProperty to avoid potential property injection alerts
    Object.defineProperty(result, key, {
      value: normalize(child),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return result;
}
