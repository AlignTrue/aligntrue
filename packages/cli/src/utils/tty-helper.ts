import { exitWithError } from "./command-utilities.js";

/**
 * TTY detection and non-interactive mode helpers
 * Prevents shell spawning errors when running in non-TTY environments
 */

/**
 * Check if current process has TTY access
 */
export function isTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return Boolean(process.env["CI"]);
}

/**
 * Check if non-interactive mode should be used
 * Returns true if:
 * - No TTY available
 * - CI environment detected
 * - Explicit non-interactive flag set
 */
export function shouldUseNonInteractive(): boolean {
  return !isTTY() || isCI();
}

/**
 * Determine if interactive mode should be used
 *
 * Checks explicit non-interactive flags and TTY availability.
 */
export function shouldUseInteractive(forceNonInteractive: boolean): boolean {
  if (forceNonInteractive) return false;

  if (!isTTY()) {
    return false;
  }

  return true;
}

/**
 * Exit with error if TTY is required but not available
 */
export function requireTTY(commandName: string): void {
  if (!isTTY()) {
    console.error(`Error: ${commandName} requires an interactive terminal`);
    console.error(
      "\nThis command needs TTY access for interactive prompts and live updates.",
    );
    console.error("Please run this command in an interactive shell.");
    exitWithError(1, `${commandName} requires an interactive terminal`);
  }
}

/**
 * Safe wrapper for clack operations that require TTY
 * Returns null if TTY not available, allowing command to provide fallback
 */
export function withTTY<T>(operation: () => T, fallback?: T): T | null {
  if (!isTTY()) {
    return fallback ?? null;
  }
  return operation();
}
