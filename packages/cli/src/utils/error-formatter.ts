/**
 * Error formatting utilities for consistent CLI error messages
 *
 * Provides standardized error display with title, message, details, hints, and error codes.
 * Ensures professional, helpful error messages across all commands.
 */

import * as clack from "@clack/prompts";

/**
 * Structured CLI error with optional details and hints
 */
export interface CLIError {
  /** Primary error title (shown in clack.log.error) */
  title: string;

  /** Detailed error message */
  message: string;

  /** Optional actionable hint for users */
  hint?: string;

  /** Optional detailed error information (bullet list) */
  details?: string[];

  /** Optional error code for support/debugging */
  code?: string;
}

/**
 * Validation error with field context
 * Standardized validation error format (Code consolidation)
 */
export interface ValidationError {
  /** Field path (e.g., "profile.id", "rules[0].applies_to") */
  field: string;

  /** Human-readable error message */
  message: string;

  /** Optional actual value that failed validation */
  value?: unknown;
}

/**
 * Format and display a CLI error without exiting
 *
 * @param error - Structured error information
 *
 * @example
 * ```typescript
 * formatError({
 *   title: 'Validation failed',
 *   message: 'Config file contains errors',
 *   details: ['Missing required field: profile.id', 'Invalid format: exporters must be array'],
 *   hint: 'Fix the errors above and try again',
 *   code: 'ERR_VALIDATION_FAILED'
 * })
 * ```
 */
export function formatError(error: CLIError): void {
  // Title in clack error style
  clack.log.error(error.title);

  // Main message
  if (error.message) {
    console.error(`\n${error.message}`);
  }

  // Detailed error list
  if (error.details && error.details.length > 0) {
    console.error("\nDetails:");
    error.details.forEach((d) => console.error(`  - ${d}`));
  }

  // Actionable hint
  if (error.hint) {
    console.error(`\nHint: ${error.hint}`);
  }

  // Error code for support
  if (error.code) {
    console.error(`\nError code: ${error.code}`);
  }
}

/**
 * Format error, display outro, and exit process
 *
 * @param error - Structured error information
 * @param exitCode - Process exit code (default: 1)
 *
 * @example
 * ```typescript
 * exitWithError(
 *   { title: 'Config not found', message: 'File missing', hint: 'Run aligntrue init' },
 *   2
 * )
 * ```
 */
export function exitWithError(error: CLIError, exitCode: number = 1): never {
  formatError(error);
  clack.outro("✗ Operation failed");
  process.exit(exitCode);
}

/**
 * Format validation errors into CLI error
 * Consolidate validation error formatting (Code consolidation)
 *
 * @param errors - Array of validation errors
 * @returns Structured CLI error
 *
 * @example
 * ```typescript
 * const validationErrors: ValidationError[] = [
 *   { field: 'profile.id', message: 'Required field is missing' },
 *   { field: 'rules[0].id', message: 'Must be a valid identifier' }
 * ];
 * exitWithError(formatValidationErrorsForCLI(validationErrors), 1);
 * ```
 */
export function formatValidationErrorsForCLI(
  errors: ValidationError[],
): CLIError {
  return {
    title: "Validation failed",
    message: `Found ${errors.length} validation error${errors.length === 1 ? "" : "s"}`,
    details: errors.map((e) =>
      e.value !== undefined
        ? `${e.field}: ${e.message} (got: ${JSON.stringify(e.value)})`
        : `${e.field}: ${e.message}`,
    ),
    hint: "Fix the errors above and try again",
    code: "ERR_VALIDATION_FAILED",
  };
}

/**
 * Common error: Config file not found
 * Standardized error pattern (Code consolidation)
 */
export function configNotFoundError(path: string): CLIError {
  return {
    title: "Config not found",
    message: `AlignTrue config file not found at: ${path}`,
    hint: 'Run "aligntrue init" to create a new config',
    code: "ERR_CONFIG_NOT_FOUND",
  };
}

/**
 * Common error: Git source error
 * Standardized error pattern (Code consolidation)
 */
export function gitSourceError(url: string, reason: string): CLIError {
  return {
    title: "Git source error",
    message: `Failed to fetch rules from git source: ${url}`,
    details: [reason],
    hint: "Verify the repository URL and your network connection",
    code: "ERR_GIT_SOURCE_FAILED",
  };
}

/**
 * Common error: Exporter failed
 * Standardized error pattern (Code consolidation)
 */
export function exporterFailedError(name: string, details: string[]): CLIError {
  return {
    title: "Export failed",
    message: `Exporter "${name}" failed to generate output`,
    details,
    hint: "Check the error details above and try again",
    code: "ERR_EXPORTER_FAILED",
  };
}
