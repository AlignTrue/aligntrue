/**
 * Test utilities for CLI command testing
 *
 * Provides helpers for mocking args, capturing output, and validating
 * help text in command tests. Optional adoption for existing tests.
 */

import { expect } from "vitest";

/**
 * Generate mock command arguments for testing
 *
 * @param overrides - Override specific args
 * @returns Array of argument strings
 *
 * @example
 * ```typescript
 * const args = mockCommandArgs({ dryRun: true, config: 'custom.yaml' })
 * // Returns: ['--dry-run', '--config', 'custom.yaml']
 * ```
 */
export function mockCommandArgs(
  overrides: {
    help?: boolean;
    dryRun?: boolean;
    force?: boolean;
    config?: string;
    acceptAgent?: string;
    [key: string]: boolean | string | undefined;
  } = {},
): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;

    // Convert camelCase to kebab-case for flags
    const flag = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;

    if (typeof value === "boolean") {
      if (value) {
        args.push(flag);
      }
    } else {
      args.push(flag, value);
    }
  }

  return args;
}

/**
 * Validate standard help text format
 *
 * Checks for required sections: Usage, Description, Options, Examples
 *
 * @param output - Help text output to validate
 * @returns Validation result with missing sections
 *
 * @example
 * ```typescript
 * const result = expectStandardHelp(helpOutput)
 * expect(result.valid).toBe(true)
 * ```
 */
export function expectStandardHelp(output: string): {
  valid: boolean;
  missing: string[];
} {
  const requiredSections = [
    { name: "Usage", pattern: /^Usage:/m },
    { name: "Description", pattern: /\n\n[\s\S]+?\n\n/m }, // Description between blank lines (multiline)
  ];

  const missing: string[] = [];

  for (const section of requiredSections) {
    if (!section.pattern.test(output)) {
      missing.push(section.name);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Capture command output for testing
 *
 * Captures stdout and stderr during command execution
 *
 * @returns Output capture utilities
 *
 * @example
 * ```typescript
 * const capture = captureCommandOutput()
 * capture.start()
 *
 * console.log('test output')
 *
 * const output = capture.stop()
 * expect(output.stdout).toContain('test output')
 * ```
 */
export function captureCommandOutput(): {
  start: () => void;
  stop: () => { stdout: string; stderr: string };
  restore: () => void;
} {
  let stdoutData = "";
  let stderrData = "";
  let originalStdoutWrite: typeof process.stdout.write;
  let originalStderrWrite: typeof process.stderr.write;
  let isCapturing = false;

  return {
    start() {
      if (isCapturing) return;

      stdoutData = "";
      stderrData = "";
      isCapturing = true;

      // Store original write functions
      originalStdoutWrite = process.stdout.write;
      originalStderrWrite = process.stderr.write;

      // Override stdout.write
      process.stdout.write = ((chunk: unknown, ...args: unknown[]): boolean => {
        const str = chunk?.toString() || "";
        stdoutData += str;
        // Still write to original for debugging if needed
        return originalStdoutWrite.call(
          process.stdout,
          chunk as Buffer,
          ...(args as [BufferEncoding?, ((err?: Error) => void)?]),
        );
      }) as typeof process.stdout.write;

      // Override stderr.write
      process.stderr.write = ((chunk: unknown, ...args: unknown[]): boolean => {
        const str = chunk?.toString() || "";
        stderrData += str;
        return originalStderrWrite.call(
          process.stderr,
          chunk as Buffer,
          ...(args as [BufferEncoding?, ((err?: Error) => void)?]),
        );
      }) as typeof process.stderr.write;
    },

    stop() {
      if (!isCapturing) {
        return { stdout: "", stderr: "" };
      }

      this.restore();

      return {
        stdout: stdoutData,
        stderr: stderrData,
      };
    },

    restore() {
      if (!isCapturing) return;

      // Restore original write functions
      if (originalStdoutWrite) {
        process.stdout.write = originalStdoutWrite;
      }
      if (originalStderrWrite) {
        process.stderr.write = originalStderrWrite;
      }

      isCapturing = false;
    },
  };
}

/**
 * Assert that output contains expected help sections
 *
 * Convenience wrapper around expectStandardHelp for vitest assertions
 *
 * @param output - Help text to validate
 *
 * @example
 * ```typescript
 * assertStandardHelp(helpOutput) // Throws if invalid
 * ```
 */
export function assertStandardHelp(output: string): void {
  const result = expectStandardHelp(output);

  if (!result.valid) {
    throw new Error(
      `Help text missing required sections: ${result.missing.join(", ")}\n\nOutput:\n${output}`,
    );
  }
}
