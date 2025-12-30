import { createHash } from "node:crypto";
import type {
  RedactionPolicy,
  RedactionStrategy,
} from "@aligntrue/ui-contracts";
import type { JSONSchema7 } from "@aligntrue/ui-contracts";

export interface RedactionResult<T> {
  redacted: T;
  warnings: string[];
}

/**
 * Apply schema-driven redaction. Honors `x-sensitive` and `x-redaction`
 * annotations on the JSON Schema. Falls back to policy defaults.
 */
export function applySchemaRedaction<T>(
  value: T,
  schema: JSONSchema7,
  policy: RedactionPolicy,
  path: string = "",
): RedactionResult<T> {
  const warnings: string[] = [];
  const redacted = redactValue(
    value as unknown,
    schema,
    policy,
    path,
    warnings,
  );
  return { redacted: redacted as T, warnings };
}

function redactValue(
  value: unknown,
  schema: JSONSchema7,
  policy: RedactionPolicy,
  path: string,
  warnings: string[],
): unknown {
  const strategy = pickStrategy(schema, policy, path, warnings);

  if (strategy === "omit") {
    return undefined;
  }
  if (strategy === "hash") {
    return hashValue(value);
  }
  if (strategy === "warn") {
    warnings.push(`Redaction warning at ${path || "/"} (warn strategy)`);
  }

  if (
    Array.isArray(value) &&
    schema.items &&
    typeof schema.items === "object"
  ) {
    return value
      .map((item, idx) =>
        redactValue(
          item,
          schema.items as JSONSchema7,
          policy,
          `${path}/${idx}`,
          warnings,
        ),
      )
      .filter((v) => v !== undefined);
  }

  if (isPlainObject(value) && schema.properties) {
    const next: Record<string, unknown> = {};
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      const childPath = `${path}/${key}`;
      // eslint-disable-next-line security/detect-object-injection
      const childValue = (value as Record<string, unknown>)[key];
      if (childValue === undefined) continue;
      const redactedChild = redactValue(
        childValue,
        childSchema as JSONSchema7,
        policy,
        childPath,
        warnings,
      );
      if (redactedChild !== undefined) {
        // eslint-disable-next-line security/detect-object-injection
        next[key] = redactedChild;
      }
    }
    return next;
  }

  return value;
}

function pickStrategy(
  schema: JSONSchema7,
  policy: RedactionPolicy,
  path: string,
  warnings: string[],
): RedactionStrategy {
  const annotations = schema as Record<string, unknown>;
  const explicitSensitive = annotations["x-sensitive"] === true;
  const explicitRedaction = annotations["x-redaction"] as
    | RedactionStrategy
    | undefined;

  if (explicitSensitive) {
    return explicitRedaction ?? "hash";
  }

  const isStringField =
    schema.type === "string" ||
    (Array.isArray(schema.type) && schema.type.includes("string"));

  if (policy.require_annotation_for_strings && isStringField) {
    warnings.push(
      `Field ${path || "/"} is string without x-sensitive annotation`,
    );
  }

  return policy.default_for_unannotated;
}

function hashValue(value: unknown): string {
  const h = createHash("sha256");
  h.update(String(value));
  return h.digest("hex");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
