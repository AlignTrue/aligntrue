import * as clack from "@clack/prompts";

const isInteractive = Boolean(process.stdout.isTTY && process.stderr.isTTY);

type ClackSpinner = ReturnType<typeof clack.spinner>;

class NoopSpinner {
  start(message?: string): void {
    if (message) {
      console.log(message);
    }
  }

  stop(message?: string, _code?: number): void {
    if (message) {
      console.log(message);
    }
  }

  message(text: string): void {
    console.log(text);
  }
}

export type SpinnerLike = ClackSpinner | NoopSpinner;

/**
 * Create a spinner instance that handles interactive/non-interactive modes
 *
 * Best Practices:
 * 1. Always track spinner state (isActive) to prevent double-stops
 * 2. Use stopSpinner() helper pattern to safely stop
 * 3. NEVER call clack.log.*() after clack.outro()
 * 4. Stop spinner without message if clack.outro() follows immediately
 *    to avoid duplicate success messages
 * 5. Use stop(msg, 1) for error states (red X)
 *
 * @example
 * ```typescript
 * const spinner = createSpinner();
 * let spinnerActive = false;
 * const stopSpinner = (msg?: string, code?: number) => {
 *   if (spinnerActive) {
 *     spinner.stop(msg, code);
 *     spinnerActive = false;
 *   }
 * };
 *
 * spinner.start("Working...");
 * spinnerActive = true;
 * // ... work ...
 * stopSpinner("Done"); // or stopSpinner() if followed by outro
 * ```
 */
export function createSpinner(options?: { disabled?: boolean }): SpinnerLike {
  if (options?.disabled || !isInteractive) {
    return new NoopSpinner();
  }
  return clack.spinner();
}

export function isInteractiveTerminal(): boolean {
  return isInteractive;
}
