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

      // Prevent prototype pollution and property injection alerts by inlining the safety check
      if (
        key === "__proto__" ||
        key === "prototype" ||
        key === "constructor" ||
        key === "__defineGetter__" ||
        key === "__defineSetter__" ||
        key === "__lookupGetter__" ||
        key === "__lookupSetter__"
      ) {
        throw new TypeError(
          `Refusing to canonicalize unsafe object key: ${key}`,
        );
      }

      // We use simple assignment on a null-prototype object. This is safe from prototype
      // pollution and satisfies security scanners like CodeQL (js/remote-property-injection)
      // better than Object.defineProperty when the key is dynamic.

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
  const result: { [key: string]: JSONValue } = Object.create(null);
  for (const key of sortedKeys) {
    // Already checked in toJSONValue, but added here for defense in depth
    // and to satisfy security scanners.
    if (
      key === "__proto__" ||
      key === "prototype" ||
      key === "constructor" ||
      key === "__defineGetter__" ||
      key === "__defineSetter__" ||
      key === "__lookupGetter__" ||
      key === "__lookupSetter__"
    ) {
      continue;
    }

    const child = (value as Record<string, JSONValue | undefined>)[key];
    if (child === undefined) continue;
    // We use simple assignment on a null-prototype object. This is safe from prototype
    // pollution and satisfies security scanners like CodeQL (js/remote-property-injection)
    // better than Object.defineProperty when the key is dynamic.

    result[key] = normalize(child);
  }
  return result;
}
