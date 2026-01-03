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

  if (value instanceof Map) {
    const entries: [string, JSONValue][] = [];
    for (const [key, child] of value.entries()) {
      if (child === undefined) continue;
      entries.push([String(key), toJSONValue(child)]);
    }
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return Object.assign(Object.create(null), Object.fromEntries(entries));
  }

  if (value instanceof Set) {
    return Array.from(value)
      .map((v) => toJSONValue(v))
      .sort((a, b) => {
        const sa = JSON.stringify(a);
        const sb = JSON.stringify(b);
        return sa.localeCompare(sb);
      });
  }

  if (typeof value === "object") {
    const entries: [string, JSONValue][] = [];
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (child === undefined) continue;

      // Prevent prototype pollution and property injection alerts by explicitly checking
      // keys. We block keys that could be used for prototype pollution or other injections.
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

      entries.push([key, toJSONValue(child)]);
    }

    // We use Object.fromEntries to build the object and then Object.assign to a
    // null-prototype object. This pattern satisfies security scanners like CodeQL
    // (js/remote-property-injection) better than a loop with Object.defineProperty
    // or manual assignment.
    return Object.assign(Object.create(null), Object.fromEntries(entries));
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
  const entries: [string, JSONValue][] = [];
  for (const key of sortedKeys) {
    // Already checked in toJSONValue, but added here for defense in depth.
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

    entries.push([key, normalize(child)]);
  }

  // We use Object.fromEntries to build the object and then Object.assign to a
  // null-prototype object. This pattern satisfies security scanners like CodeQL
  // (js/remote-property-injection) better than a loop with Object.defineProperty
  // or manual assignment.
  return Object.assign(Object.create(null), Object.fromEntries(entries));
}
