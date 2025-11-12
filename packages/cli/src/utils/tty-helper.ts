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
 * Exit with error if TTY is required but not available
 */
export function requireTTY(commandName: string): void {
  if (!isTTY()) {
    console.error(`Error: ${commandName} requires an interactive terminal`);
    console.error(
      "\nThis command needs TTY access for interactive prompts and live updates.",
    );
    console.error("Please run this command in an interactive shell.");
    process.exit(1);
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
