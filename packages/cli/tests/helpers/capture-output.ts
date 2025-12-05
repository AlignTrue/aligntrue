/**
 * Capture console output during a test run.
 * Restores original console methods after execution.
 */
import { ProcessExitError } from "./exit-mock.js";

export async function captureOutput(
  fn: () => Promise<void> | void,
): Promise<{ stdout: string; stderr: string }> {
  const originalLog = console.log;
  const originalError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];

  console.log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.map(String).join(" "));
  };

  try {
    await fn();
  } catch (error) {
    // Commands often signal termination via mocked process.exit; capture output
    // but do not treat that as a failure for the test harness.
    if (!(error instanceof ProcessExitError)) {
      throw error;
    }
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}
