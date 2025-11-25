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
 * Managed spinner wrapper that encapsulates lifecycle management
 *
 * Prevents double-stops and simplifies the common pattern of:
 * - Starting a spinner
 * - Tracking active state
 * - Safely stopping with optional message
 */
class ManagedSpinner {
  private spinner: SpinnerLike;
  private isActive = false;

  constructor(spinner: SpinnerLike) {
    this.spinner = spinner;
  }

  start(message?: string): void {
    if (!this.isActive) {
      this.spinner.start(message);
      this.isActive = true;
    }
  }

  stop(message?: string, code?: number): void {
    if (this.isActive) {
      this.spinner.stop(message, code);
      this.isActive = false;
    }
  }

  message(text: string): void {
    this.spinner.message(text);
  }

  isRunning(): boolean {
    return this.isActive;
  }
}

/**
 * Create a spinner instance that handles interactive/non-interactive modes
 *
 * @param options - Optional configuration
 * @returns Spinner instance (interactive or noop)
 *
 * @example
 * ```typescript
 * const spinner = createSpinner();
 * spinner.start("Working...");
 * // ... work ...
 * spinner.stop("Done");
 * ```
 */
export function createSpinner(options?: { disabled?: boolean }): SpinnerLike {
  if (options?.disabled || !isInteractive) {
    return new NoopSpinner();
  }
  return clack.spinner();
}

/**
 * Create a managed spinner with automatic lifecycle handling
 *
 * @param options - Optional configuration
 * @returns Managed spinner with state tracking
 *
 * @example
 * ```typescript
 * const spinner = createManagedSpinner();
 * spinner.start("Working...");
 * spinner.stop("Done");
 * // Calling stop() again is safe - no-op
 * ```
 */
export function createManagedSpinner(options?: {
  disabled?: boolean;
}): ManagedSpinner {
  return new ManagedSpinner(createSpinner(options));
}

/**
 * Execute work with automatic spinner lifecycle management
 *
 * Simplifies the common pattern of:
 * 1. Create spinner
 * 2. Start with initial message
 * 3. Do work
 * 4. Stop with completion message (or error)
 *
 * @param startMessage - Message to display while working
 * @param work - Async function to execute
 * @param successMessage - Optional message when work completes successfully
 * @param onError - Optional error handler (called with error, should rethrow if needed)
 * @returns Promise that resolves when work completes
 *
 * @example
 * ```typescript
 * await withSpinner("Processing...", async () => {
 *   await someAsyncWork();
 * }, "Done!");
 * ```
 *
 * @example
 * ```typescript
 * await withSpinner(
 *   "Validating...",
 *   async () => {
 *     const result = await validate();
 *     if (!result.valid) throw new Error(result.error);
 *   },
 *   "Valid",
 *   (err) => {
 *     console.error("Validation failed:", err.message);
 *     throw err;
 *   }
 * );
 * ```
 */
export async function withSpinner(
  startMessage: string,
  work: () => Promise<void>,
  successMessage?: string,
  onError?: (error: Error) => void,
): Promise<void> {
  const spinner = createManagedSpinner();

  try {
    spinner.start(startMessage);
    await work();
    spinner.stop(successMessage);
  } catch (error) {
    spinner.stop((error as Error).message, 1);
    if (onError) {
      onError(error as Error);
    } else {
      throw error;
    }
  }
}

export function isInteractiveTerminal(): boolean {
  return isInteractive;
}
