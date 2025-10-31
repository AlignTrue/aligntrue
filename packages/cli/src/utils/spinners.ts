/**
 * Standardized spinner utilities for CLI commands
 *
 * Phase 4.5: Consolidates spinner patterns across all commands
 */

import * as clack from "@clack/prompts";

/**
 * Execute an async operation with a spinner
 *
 * Displays a spinner during operation, then shows success or error message.
 * Automatically handles cleanup and error formatting.
 *
 * @param operation - Async function to execute
 * @param message - Spinner message to display during operation
 * @param successMessage - Optional message to display on success
 * @returns Result of the operation
 * @throws Re-throws any errors from the operation
 *
 * @example
 * ```typescript
 * const result = await withSpinner(
 *   () => exportAllRules(config),
 *   'Exporting rules to agents',
 *   'Exported 5 files'
 * );
 * ```
 */
export async function withSpinner<T>(
  operation: () => Promise<T>,
  message: string,
  successMessage?: string,
): Promise<T> {
  const spinner = clack.spinner();
  spinner.start(message);

  try {
    const result = await operation();
    spinner.stop(successMessage || "Complete");
    return result;
  } catch (error) {
    spinner.stop("Failed");
    throw error; // Re-throw for caller to handle
  }
}

/**
 * Execute multiple operations sequentially with spinners
 *
 * Useful for commands that have multiple steps.
 * Shows individual spinner for each step.
 *
 * @param steps - Array of {operation, message, successMessage} objects
 * @returns Array of results from all operations
 * @throws Stops at first error and re-throws it
 *
 * @example
 * ```typescript
 * const [config, rules] = await withSpinners([
 *   { operation: () => loadConfig(), message: 'Loading config' },
 *   { operation: () => loadRules(), message: 'Loading rules', successMessage: 'Loaded 10 rules' }
 * ]);
 * ```
 */
export async function withSpinners<T extends unknown[]>(
  steps: Array<{
    operation: () => Promise<any>;
    message: string;
    successMessage?: string;
  }>,
): Promise<T> {
  const results: any[] = [];

  for (const step of steps) {
    const result = await withSpinner(
      step.operation,
      step.message,
      step.successMessage,
    );
    results.push(result);
  }

  return results as T;
}
