/**
 * Test helper for mocking process.exit
 *
 * The mock throws an error to stop execution (simulating real exit behavior)
 * while capturing the exit code for assertions.
 */

export class ProcessExitError extends Error {
  constructor(public exitCode: number) {
    super(`Process exited with code ${exitCode}`);
    this.name = "ProcessExitError";
  }
}

export interface ExitMock {
  exitCode: number | undefined;
  restore: () => void;
}

/**
 * Mock process.exit to capture exit codes and stop execution
 *
 * @returns Object with exitCode property and restore function
 *
 * @example
 * ```typescript
 * const exitMock = mockProcessExit();
 *
 * try {
 *   await command(args);
 * } catch (e) {
 *   // Expected exit
 * }
 *
 * expect(exitMock.exitCode).toBe(1);
 * exitMock.restore();
 * ```
 */
export function mockProcessExit(): ExitMock {
  const originalExit = process.exit;
  let exitCode: number | undefined;

  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new ProcessExitError(exitCode);
  }) as never;

  return {
    get exitCode() {
      return exitCode;
    },
    restore() {
      process.exit = originalExit;
    },
  };
}
