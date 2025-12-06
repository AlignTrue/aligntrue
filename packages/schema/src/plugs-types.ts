/**
 * Type definitions for Plugs v1.1
 *
 * Plugs enable stack-agnostic rule authoring by allowing base aligns to declare
 * configurable slots that stack aligns or repos can fill with concrete values.
 */

/**
 * Plug format types
 * NOTE: "file" and "url" are deprecated; they are still validated for safety.
 */
export type PlugFormat = "command" | "text" | "file" | "url";

/**
 * Slot declaration in base aligns
 * Declares a configurable value that must be provided by stack/repo
 */
export interface PlugSlot {
  description: string; // One short sentence explaining what this plug is for
  format: PlugFormat; // Format validation type
  required: boolean; // Whether this slot must be filled
  example?: string; // Single-line example (recommended for required slots)
}

/**
 * Fill provided by stack aligns or repo-local aligns
 * Supplies concrete value for a declared slot
 */
export type PlugFill = string; // Non-empty single-line scalar

/**
 * Plugs section in align align
 */
export interface Plugs {
  slots?: Record<string, PlugSlot>; // Declared by base aligns
  fills?: Record<string, PlugFill>; // Provided by stack/repo
}

/**
 * Validation result for plug key format
 */
export interface PlugKeyValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validation result for plug value format
 */
export interface PlugValueValidation {
  valid: boolean;
  error?: string;
  sanitized?: string; // Sanitized value (e.g., trimmed)
}

/**
 * Validate plug key format
 *
 * Rules:
 * - Must match pattern: ^[a-z0-9._-]+$
 * - Must NOT start with 'stack.' or 'sys.'
 *
 * @param key - Plug key to validate
 * @returns Validation result
 */
export function validatePlugKey(key: string): PlugKeyValidation {
  // Check basic pattern
  const pattern = /^[a-z0-9._-]+$/;
  if (!pattern.test(key)) {
    return {
      valid: false,
      error: `Plug key must match pattern: ^[a-z0-9._-]+$ (got: ${key})`,
    };
  }

  // Forbid reserved prefixes
  if (key.startsWith("stack.") || key.startsWith("sys.")) {
    return {
      valid: false,
      error: `Plug key must not start with 'stack.' or 'sys.' (got: ${key})`,
    };
  }

  return { valid: true };
}

/**
 * Validate plug value format
 *
 * Rules by format:
 * - command: Single line, no env vars except CI=true
 * - text/file/url: Single line, any UTF-8 (file/url are deprecated)
 *
 * @param value - Value to validate
 * @param format - Expected format
 * @returns Validation result
 */
export function validatePlugValue(
  value: string,
  format: PlugFormat,
): PlugValueValidation {
  // Trim whitespace
  const trimmed = value.trim();

  // Check non-empty
  if (trimmed.length === 0) {
    return {
      valid: false,
      error: `Plug value cannot be empty`,
    };
  }

  // Check single-line
  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    return {
      valid: false,
      error: `Plug value must be single line (got multiline value)`,
    };
  }

  // Format-specific validation
  switch (format) {
    case "command": {
      // No env var interpolation except CI=true
      const envVarPattern = /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/g;
      const envVars = trimmed.match(envVarPattern) || [];
      const invalidEnvVars = envVars.filter((v) => {
        const varName = v.replace(/[${}]/g, "");
        return varName !== "CI";
      });

      if (invalidEnvVars.length > 0) {
        return {
          valid: false,
          error: `Command format forbids env vars (except CI=true). Found: ${invalidEnvVars.join(", ")}`,
        };
      }
      break;
    }

    case "file":
    case "url":
    case "text":
      break;

    default:
      return {
        valid: false,
        error: `Unknown format: ${format}`,
      };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate plug slot definition
 *
 * @param slot - Slot to validate
 * @returns Validation result
 */
export function validatePlugSlot(slot: PlugSlot): PlugValueValidation {
  // Check description
  if (!slot.description || slot.description.trim().length === 0) {
    return {
      valid: false,
      error: "Slot description is required",
    };
  }

  // Check format is valid
  const validFormats: PlugFormat[] = ["command", "text", "file", "url"];
  if (!validFormats.includes(slot.format)) {
    return {
      valid: false,
      error: `Invalid format: ${slot.format}. Must be one of: ${validFormats.join(", ")}`,
    };
  }

  // Validate example if present
  if (slot.example !== undefined) {
    const exampleValidation = validatePlugValue(slot.example, slot.format);
    if (!exampleValidation.valid) {
      return {
        valid: false,
        error: `Invalid example: ${exampleValidation.error}`,
      };
    }
  }

  // Warn if required but no example (not an error, just advisory)
  if (slot.required && !slot.example) {
    // This is a warning, not an error - return valid but could be logged
  }

  return { valid: true };
}
