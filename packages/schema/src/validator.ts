import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseYamlToJson, computeAlignHash } from "./canonicalize.js";

// Load the JSON Schema
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "../schema/align.schema.json");
const alignSchema = JSON.parse(readFileSync(schemaPath, "utf8"));

// Initialize Ajv in strict mode
const ajv = new Ajv({
  strict: true,
  allErrors: true,
  verbose: true,
  // Add draft 2020-12 support
  validateSchema: false, // Disable metaschema validation to avoid the missing schema error
});
addFormats(ajv);

const validateFn: ValidateFunction = ajv.compile(alignSchema);

/**
 * Result of schema validation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * Formatted validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

/**
 * Result of integrity validation
 */
export interface IntegrityResult {
  valid: boolean;
  storedHash?: string | undefined;
  computedHash?: string | undefined;
  error?: string | undefined;
}

/**
 * Options for mode-dependent validation
 */
export interface ValidationOptions {
  mode?: "solo" | "team" | "catalog";
  requireIntegrity?: boolean;
}

/**
 * Validate an Align pack against the JSON Schema
 *
 * @param obj - Parsed Align pack object
 * @param options - Validation options for mode-dependent rules
 * @returns ValidationResult with errors if invalid
 */
export function validateAlignSchema(
  obj: unknown,
  options?: ValidationOptions,
): ValidationResult {
  const valid = validateFn(obj);

  if (!valid) {
    const errors = formatValidationErrors(validateFn.errors || []);
    return { valid: false, errors };
  }

  // Mode-specific validation
  const modeErrors: ValidationError[] = [];
  const mode = options?.mode || "solo";
  const pack = obj as Record<string, unknown>;

  if (mode === "team") {
    // Team mode requires summary
    if (!pack["summary"]) {
      modeErrors.push({
        path: "/summary",
        message: "summary is required in team mode",
      });
    }
    // Provenance fields required when source is specified
    if (pack["source"] && !pack["owner"]) {
      modeErrors.push({
        path: "/owner",
        message: "owner is required when source is specified in team mode",
      });
    }
    if (pack["source"] && !pack["source_sha"]) {
      modeErrors.push({
        path: "/source_sha",
        message: "source_sha is required when source is specified in team mode",
      });
    }
  }

  if (mode === "catalog") {
    // Catalog mode requires all team fields plus distribution metadata
    if (!pack["summary"]) {
      modeErrors.push({
        path: "/summary",
        message: "summary is required in catalog mode",
      });
    }
    if (!pack["owner"]) {
      modeErrors.push({
        path: "/owner",
        message: "owner is required in catalog mode",
      });
    }
    if (!pack["source"]) {
      modeErrors.push({
        path: "/source",
        message: "source is required in catalog mode",
      });
    }
    if (!pack["source_sha"]) {
      modeErrors.push({
        path: "/source_sha",
        message: "source_sha is required in catalog mode",
      });
    }
    if (
      !pack["tags"] ||
      (Array.isArray(pack["tags"]) && pack["tags"].length === 0)
    ) {
      modeErrors.push({
        path: "/tags",
        message: "tags are required in catalog mode",
      });
    }
    if (!pack["integrity"] && options?.requireIntegrity !== false) {
      modeErrors.push({
        path: "/integrity",
        message: "integrity is required in catalog mode",
      });
    }
  }

  if (modeErrors.length > 0) {
    return { valid: false, errors: modeErrors };
  }

  return { valid: true };
}

/**
 * Format Ajv errors into user-friendly messages
 */
function formatValidationErrors(ajvErrors: ErrorObject[]): ValidationError[] {
  return ajvErrors.map((err) => ({
    path: err.instancePath || "(root)",
    message: err.message || "Validation failed",
    keyword: err.keyword,
    params: err.params,
  }));
}

/**
 * Validate Align pack integrity hash
 *
 * Extracts the stored hash from integrity.value, recomputes the hash,
 * and compares. Returns detailed result.
 *
 * @param alignYaml - YAML string of Align pack
 * @returns IntegrityResult with validation details
 */
export function validateAlignIntegrity(alignYaml: string): IntegrityResult {
  try {
    // Parse to extract stored hash
    const obj = parseYamlToJson(alignYaml) as Record<string, unknown>;

    // If no integrity field, it's valid (solo mode doesn't require it)
    if (!obj["integrity"] || typeof obj["integrity"] !== "object") {
      return {
        valid: true,
        storedHash: undefined,
        computedHash: undefined,
      };
    }

    const integrity = obj["integrity"] as Record<string, unknown>;
    const storedHash = integrity["value"] as string;

    // Allow <computed> and <pending> placeholders during authoring
    if (storedHash === "<computed>" || storedHash === "<pending>") {
      return {
        valid: true,
        storedHash,
        computedHash: storedHash,
      };
    }

    // Compute actual hash
    const computedHash = computeAlignHash(alignYaml);

    return {
      valid: computedHash === storedHash,
      storedHash,
      computedHash,
    };
  } catch (_err) {
    return {
      valid: false,
      error: _err instanceof Error ? _err.message : "Unknown error",
    };
  }
}

/**
 * Validate both schema and integrity of an Align pack
 *
 * @param alignYaml - YAML string of Align pack
 * @returns Combined validation result
 */
export function validateAlign(alignYaml: string): {
  schema: ValidationResult;
  integrity: IntegrityResult;
} {
  const obj = parseYamlToJson(alignYaml);
  const schema = validateAlignSchema(obj);
  const integrity = validateAlignIntegrity(alignYaml);

  return { schema, integrity };
}

// Export types for Align pack structure based on schema (v1)
export interface AlignPack {
  id: string;
  version: string;
  spec_version: "1";
  summary?: string;

  // Team mode provenance
  owner?: string;
  source?: string;
  source_sha?: string;

  // Vendored pack metadata (Team mode)
  vendor_path?: string;
  vendor_type?: "submodule" | "subtree" | "manual";

  // Catalog mode (removed from roadmap)
  tags?: string[];
  deps?: string[];
  scope?: AlignScope;

  // Content: natural markdown sections
  sections: AlignSection[];
  integrity?: AlignIntegrity;

  // Plugs v1.1 (Plugs system)
  plugs?: {
    slots?: Record<
      string,
      {
        description: string;
        format: "command" | "text" | "file" | "url";
        required: boolean;
        example?: string;
      }
    >;
    fills?: Record<string, string>;
  };

  // Markdown metadata (for round-trip preservation)
  _markdown_meta?: MarkdownMetadata;
}

/**
 * AlignTrue-specific vendor metadata for scope tracking
 * Stored in section.vendor.aligntrue
 */
export interface AlignTrueVendorMetadata {
  source_scope?: string; // Scope this section originated from (e.g., "backend", "frontend", "default")
  source_file?: string; // Original file path (e.g., ".cursor/rules/backend.mdc")
  last_modified?: string; // ISO 8601 timestamp of last modification
}

/**
 * Natural markdown section (new format)
 */
export interface AlignSection {
  heading: string; // Section heading (e.g., "Testing instructions")
  level: number; // Heading level: 2 for ##, 3 for ###, etc.
  content: string; // Full markdown content under this heading
  fingerprint: string; // Auto-generated stable identifier

  // Optional explicit metadata
  explicitId?: string; // User-specified ID via HTML comment

  // Agent-specific metadata (for round-trip preservation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vendor?: Record<string, any> & {
    aligntrue?: AlignTrueVendorMetadata;
  };
}

export interface MarkdownMetadata {
  original_structure?: "single-block" | "multi-rule";
  header_prefix?: string;
  guidance_position?: "before-block" | "in-doc";
  whitespace_style?: {
    indent: "spaces" | "tabs";
    indent_size: number;
    line_endings: "lf" | "crlf";
  };
}

export interface AlignScope {
  applies_to?: string[];
  includes?: string[];
  excludes?: string[];
}

export interface AlignIntegrity {
  algo: "jcs-sha256";
  value: string;
}
