import { createHash } from "crypto";
import { parse as parseYaml } from "yaml";
import canonicalize from "canonicalize";

/**
 * Parse YAML string to plain JavaScript object
 */
export function parseYamlToJson(yaml: string): unknown {
  const result = parseYaml(yaml, { merge: true });
  // yaml package returns null for empty documents, convert to undefined for consistency
  return result === null && yaml.trim() === "" ? undefined : result;
}

/**
 * Apply JCS (RFC 8785) canonicalization to an object
 * Returns canonical JSON string with stable key ordering
 *
 * @param obj - Object to canonicalize
 * @param excludeVolatile - If true, exclude vendor.*.volatile fields from hash
 */
export function canonicalizeJson(
  obj: unknown,
  excludeVolatile: boolean = true,
): string {
  const normalized = excludeVolatile ? filterVolatileVendorFields(obj) : obj;
  const canonical = canonicalize(normalized);
  if (canonical === undefined) {
    throw new Error("Canonicalization failed: input produced undefined");
  }
  return canonical;
}

/**
 * Filter out volatile vendor fields based on vendor._meta.volatile paths
 */
function filterVolatileVendorFields(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(filterVolatileVendorFields);
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    // Check if this object has vendor._meta.volatile
    const vendor = obj["vendor"];
    if (vendor && typeof vendor === "object") {
      const vendorObj = vendor as Record<string, unknown>;
      const meta = vendorObj["_meta"];
      if (meta && typeof meta === "object") {
        const metaObj = meta as Record<string, unknown>;
        if (metaObj["volatile"]) {
          const volatilePaths = metaObj["volatile"] as string[];
          result["vendor"] = filterVolatilePaths(vendorObj, volatilePaths);
        } else {
          result["vendor"] = filterVolatileVendorFields(vendor);
        }
      } else {
        result["vendor"] = filterVolatileVendorFields(vendor);
      }
    }

    // Process all other keys
    for (const key in obj) {
      if (key === "vendor") continue; // Already handled
      result[key] = filterVolatileVendorFields(obj[key]);
    }

    return result;
  }

  return data;
}

/**
 * Filter specific paths from vendor object based on volatile list
 * Paths use dot notation, e.g., "cursor.session_id"
 */
function filterVolatilePaths(
  vendor: Record<string, unknown>,
  volatilePaths: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key in vendor) {
    if (key === "_meta") {
      // Preserve _meta for metadata, but it doesn't affect hashing
      result[key] = vendor[key];
      continue;
    }

    const vendorValue = vendor[key];
    if (typeof vendorValue === "object" && vendorValue !== null) {
      const subVendor = vendorValue as Record<string, unknown>;
      const subResult: Record<string, unknown> = {};
      for (const subKey in subVendor) {
        const path = `${key}.${subKey}`;
        if (!volatilePaths.includes(path)) {
          subResult[subKey] = subVendor[subKey];
        }
      }
      if (Object.keys(subResult).length > 0) {
        result[key] = subResult;
      }
    } else {
      result[key] = vendorValue;
    }
  }

  return result;
}

/**
 * Compute SHA-256 hash of a string and return hex-encoded result
 */
export function computeHash(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Compute integrity hash for an Align align
 *
 * Process:
 * 1. Parse YAML to object (if string) or use object directly
 * 2. Set integrity.value to "<pending>" (if integrity field exists)
 * 3. Filter volatile vendor fields
 * 4. Apply JCS canonicalization
 * 5. Compute SHA-256 hash
 *
 * @param alignInput - YAML string or object of Align align
 * @returns Hex-encoded SHA-256 hash
 */
export function computeAlignHash(alignInput: string | unknown): string {
  // Parse YAML to object or use object directly
  const obj =
    typeof alignInput === "string"
      ? (parseYamlToJson(alignInput) as Record<string, unknown>)
      : (alignInput as Record<string, unknown>);

  // Clone to avoid mutating input using structuredClone
  const cloned =
    typeof structuredClone !== "undefined"
      ? structuredClone(obj)
      : JSON.parse(JSON.stringify(obj));

  // Set integrity.value to pending if integrity field exists
  if (cloned["integrity"] && typeof cloned["integrity"] === "object") {
    const integrity = cloned["integrity"] as Record<string, unknown>;
    integrity["value"] = "<pending>";
  }

  // Canonicalize (with volatile field filtering) and hash
  const canonical = canonicalizeJson(cloned, true);
  return computeHash(canonical);
}

/**
 * Validate that a stored hash matches the computed hash
 *
 * @param alignYaml - YAML string of Align align
 * @param storedHash - The hash value from integrity.value field
 * @returns true if hashes match
 */
export function verifyAlignHash(
  alignYaml: string,
  storedHash: string,
): boolean {
  const computed = computeAlignHash(alignYaml);
  return computed === storedHash;
}
