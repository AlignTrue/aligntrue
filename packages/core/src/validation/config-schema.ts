import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import configSchema from "../schemas/config.schema.json" with { type: "json" };

export interface SchemaValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    keyword?: string;
    params?: Record<string, unknown>;
  }>;
}

const ajv = new Ajv({
  strict: true,
  allErrors: true,
  verbose: true,
  validateSchema: false,
});
addFormats(ajv);
ajv.addKeyword("x-sensitive");
ajv.addKeyword("x-redaction");

const validateSchemaFn: ValidateFunction = ajv.compile(configSchema);

export function validateConfigSchema(config: unknown): SchemaValidationResult {
  const valid = validateSchemaFn(config);

  if (valid) {
    return { valid: true };
  }

  const errors = (validateSchemaFn.errors || []).map((err: ErrorObject) => {
    const path = err.instancePath || "(root)";
    let message = err.message || "Validation error";

    if (err.keyword === "enum") {
      const allowedValues =
        (err.params as { allowedValues?: unknown[] }).allowedValues || [];
      message = `${message}. Allowed values: ${allowedValues.join(", ")}`;
    } else if (err.keyword === "required") {
      const missingProperty = (err.params as { missingProperty?: string })
        .missingProperty;
      message = `Missing required field: ${missingProperty}`;
    } else if (err.keyword === "type") {
      const expectedType = (err.params as { type?: string }).type;
      message = `Expected type ${expectedType}`;
    }

    return {
      path: path.replace(/^\//, "").replace(/\//g, ".") || "(root)",
      message,
      keyword: err.keyword,
      params: err.params as Record<string, unknown>,
    };
  });

  return { valid: false, errors };
}

export function formatConfigValidationErrors(
  errors: SchemaValidationResult["errors"],
): string {
  if (!errors || errors.length === 0) {
    return "Unknown validation error";
  }

  return errors.map((err) => `  - ${err.path}: ${err.message}`).join("\n");
}
