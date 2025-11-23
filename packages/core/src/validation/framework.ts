/**
 * Unified Validation Framework
 *
 * Provides standardized types and helpers for validation across the codebase.
 * Consolidates error reporting, result types, and common validators.
 */

/**
 * Standard validation result
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** List of errors if invalid */
  errors?: ValidationIssue[];
  /** List of warnings (non-blocking issues) */
  warnings?: ValidationWarning[];
}

/**
 * Standard validation error detail
 */
export interface ValidationIssue {
  /** Path to the invalid field or file */
  path: string;
  /** User-friendly error message */
  message: string;
  /** Error code/keyword for programmatic handling */
  code?: string;
  /** Additional context params */
  params?: Record<string, unknown>;
  /** Next steps or hints for fixing the error */
  hint?: string;
}

/**
 * Standard validation warning
 */
export interface ValidationWarning {
  /** Path to the issue */
  path: string;
  /** User-friendly warning message */
  message: string;
  /** Warning code */
  code?: string;
}

/**
 * Helper to create a successful result
 */
export function valid(): ValidationResult {
  return { valid: true };
}

/**
 * Helper to create a failed result with a single error
 */
export function invalid(
  message: string,
  path: string = "(root)",
  options?: { code?: string; params?: Record<string, unknown>; hint?: string },
): ValidationResult {
  return {
    valid: false,
    errors: [
      {
        message,
        path,
        ...options,
      },
    ],
  };
}

/**
 * Helper to merge multiple validation results
 */
export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const merged: ValidationResult = { valid: true };
  const errors: ValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];

  for (const result of results) {
    if (!result.valid) {
      merged.valid = false;
      if (result.errors) {
        errors.push(...result.errors);
      }
    }
    if (result.warnings) {
      warnings.push(...result.warnings);
    }
  }

  if (errors.length > 0) merged.errors = errors;
  if (warnings.length > 0) merged.warnings = warnings;

  return merged;
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationIssue[]): string {
  return errors
    .map((err) => {
      let msg = `  • ${err.path}: ${err.message}`;
      if (err.hint) {
        msg += `\n    Hint: ${err.hint}`;
      }
      return msg;
    })
    .join("\n");
}
