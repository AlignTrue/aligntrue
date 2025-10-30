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
