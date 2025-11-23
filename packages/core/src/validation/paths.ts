/**
 * Path Validation Utilities
 *
 * Consolidates path checking logic to ensure security and consistency.
 */

import { ValidationResult, valid, invalid } from "./framework.js";

/**
 * Validate a file path for security and correctness
 * - Must be relative (no absolute paths)
 * - No parent directory traversal (../)
 * - Must not be empty
 */
export function validateRelativePath(
  path: string,
  label: string = "Path",
): ValidationResult {
  if (!path || path.trim() === "") {
    return invalid(`${label} cannot be empty`);
  }

  // Check for absolute paths
  // Unix absolute or Windows drive letter
  if (path.startsWith("/") || /^[A-Z]:[/\\]/i.test(path)) {
    return invalid(`${label} must be relative, not absolute.`, path, {
      hint: "Remove leading slash or drive letter.",
    });
  }

  // Check for parent directory traversal
  if (path.includes("../") || path.includes("..\\")) {
    return invalid(
      `${label} cannot contain parent directory traversal (../).`,
      path,
      { hint: "Paths must remain within the project root." },
    );
  }

  return valid();
}

/**
 * Validate a scope path
 * Same as relative path but strict about scope naming conventions if needed
 */
export function checkScopePath(path: string): ValidationResult {
  // First check basic relative path safety
  const baseCheck = validateRelativePath(path, "Scope path");
  if (!baseCheck.valid) return baseCheck;

  // Additional scope-specific checks could go here
  // e.g. valid characters

  return valid();
}

/**
 * Validate a URL
 */
export function validateUrl(value: string): ValidationResult {
  if (!value || value.trim() === "") {
    return invalid("URL cannot be empty");
  }

  try {
    const url = new URL(value);

    // Ensure protocol is present and valid
    if (!url.protocol || !["http:", "https:"].includes(url.protocol)) {
      return invalid("URL must use http:// or https:// protocol.", value, {
        hint: "Add http:// or https:// prefix.",
      });
    }

    return valid();
  } catch {
    return invalid("Invalid URL format.", value, {
      hint: "Must be a valid URL (e.g., https://example.com).",
    });
  }
}

/**
 * Validate a glob pattern
 */
export function validateGlobPattern(pattern: string): ValidationResult {
  if (!pattern || pattern.trim() === "") {
    return invalid("Glob pattern cannot be empty");
  }

  // Prevent ReDoS with overly long patterns
  if (pattern.length > 200) {
    return invalid("Glob pattern exceeds maximum length of 200 characters");
  }

  return valid();
}
