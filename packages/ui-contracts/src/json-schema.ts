import type { JSONSchema7 } from "json-schema";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * JSON Schema draft reference used across the UI contracts.
 */
export const JSON_SCHEMA_DRAFT = "http://json-schema.org/draft-07/schema#";

/**
 * Convert a Zod schema to JSON Schema draft-07.
 */
export function toJsonSchemaDraft(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any,
  options?: Record<string, unknown>,
): JSONSchema7 {
  return zodToJsonSchema(schema, {
    target: "jsonSchema7",
    ...(options ?? {}),
  }) as JSONSchema7;
}

export type { JSONSchema7 };
