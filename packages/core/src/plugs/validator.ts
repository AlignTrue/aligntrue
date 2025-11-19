/**
 * Plugs fill validation
 * Validates fill values against slot format requirements
 */

export type PlugFormat = "command" | "file" | "url" | "text";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a command format fill
 * - No absolute paths
 * - No parent directory traversal
 * - Must be a simple command or relative path
 */
export function validateCommand(value: string): ValidationResult {
  if (!value || value.trim() === "") {
    return { valid: false, error: "Command cannot be empty" };
  }

  // Check for absolute paths
  if (value.startsWith("/") || /^[A-Z]:[/\\]/.test(value)) {
    return {
      valid: false,
      error:
        "Command cannot be an absolute path. Use relative paths or command names only.",
    };
  }

  // Check for parent directory traversal
  if (value.includes("../") || value.includes("..\\")) {
    return {
      valid: false,
      error: "Command cannot contain parent directory traversal (../).",
    };
  }

  return { valid: true };
}

/**
 * Validate a file format fill
 * - Must be relative path
 * - No absolute paths
 * - No parent directory traversal
 */
export function validateFile(value: string): ValidationResult {
  if (!value || value.trim() === "") {
    return { valid: false, error: "File path cannot be empty" };
  }

  // Check for absolute paths
  if (value.startsWith("/") || /^[A-Z]:[/\\]/.test(value)) {
    return {
      valid: false,
      error: "File path must be relative, not absolute.",
    };
  }

  // Check for parent directory traversal
  if (value.includes("../") || value.includes("..\\")) {
    return {
      valid: false,
      error: "File path cannot contain parent directory traversal (../).",
    };
  }

  return { valid: true };
}

/**
 * Validate a URL format fill
 * - Must be a valid URL with protocol
 */
export function validateUrl(value: string): ValidationResult {
  if (!value || value.trim() === "") {
    return { valid: false, error: "URL cannot be empty" };
  }

  try {
    const url = new URL(value);

    // Ensure protocol is present and valid
    if (!url.protocol || !["http:", "https:"].includes(url.protocol)) {
      return {
        valid: false,
        error: "URL must use http:// or https:// protocol.",
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error:
        "Invalid URL format. Must include protocol (e.g., https://example.com).",
    };
  }
}

/**
 * Validate a text format fill
 * - Any non-empty string is valid
 */
export function validateText(value: string): ValidationResult {
  if (!value || value.trim() === "") {
    return { valid: false, error: "Text value cannot be empty" };
  }

  return { valid: true };
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
