import type { Align } from "@aligntrue/schema";
import { validateAlignSchema } from "@aligntrue/schema";

export interface SchemaValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate Align document against schema.
 */
export function validateSchema(align: Align): SchemaValidationResult {
  const schemaResult = validateAlignSchema(align);

  if (schemaResult.valid) {
    return { valid: true };
  }

  const details = (schemaResult.errors || []).map(
    (err) => `${err.path}: ${err.message}`,
  );

  return {
    valid: false,
    errors: details,
  };
}
