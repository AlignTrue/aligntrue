/**
 * Plugs fill validation
 * Validates fill values against slot format requirements
 */

import {
  ValidationResult,
  validateRelativePath,
  valid,
  invalid,
} from "../validation/index.js";

// Supported formats.
export type PlugFormat = "command" | "text" | "file" | "url";
export type { ValidationResult };

/**
 * Validate a command format fill
 * - No absolute paths
 * - No parent directory traversal
 * - Must be a simple command or relative path
 */
export function validateCommand(value: string): ValidationResult {
  return validateRelativePath(value, "Command");
}

/**
 * Validate a file format fill (deprecated)
 * - Treated as text for backward compatibility
 */
export function validateFile(value: string): ValidationResult {
  return validateText(value);
}

/**
 * Validate a URL format fill (deprecated)
 * - Treated as text for backward compatibility
 */
export function validateUrl(value: string): ValidationResult {
  return validateText(value);
}

/**
 * Validate a text format fill
 * - Any non-empty string is valid
 */
export function validateText(value: string): ValidationResult {
  if (!value || value.trim() === "") {
    return invalid("Text value cannot be empty");
  }

  return valid();
}

/**
 * Validate a fill value against its slot format
 */
export function validateFill(
  value: string,
  format: PlugFormat = "text",
): ValidationResult {
  switch (format) {
    case "command":
      return validateCommand(value);
    case "file":
      return validateFile(value);
    case "url":
      return validateUrl(value);
    default:
      return validateText(value);
  }
}
