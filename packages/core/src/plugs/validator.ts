/**
 * Plugs fill validation
 * Validates fill values against slot format requirements
 */

import {
  ValidationResult,
  validateRelativePath,
  validateUrl as validateUrlFramework,
  valid,
  invalid,
} from "../validation/index.js";

export type PlugFormat = "command" | "file" | "url" | "text";
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
 * Validate a file format fill
 * - Must be relative path
 * - No absolute paths
 * - No parent directory traversal
 */
export function validateFile(value: string): ValidationResult {
  return validateRelativePath(value, "File path");
}

/**
 * Validate a URL format fill
 * - Must be a valid URL with protocol
 */
export function validateUrl(value: string): ValidationResult {
  return validateUrlFramework(value);
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
    case "text":
    default:
      return validateText(value);
  }
}
