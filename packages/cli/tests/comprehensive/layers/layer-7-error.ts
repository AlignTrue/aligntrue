/**
 * Layer 7: Error & UX
 * User trust via helpful errors and predictable behavior
 */

import { execSync, type ExecException } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertTestSafety } from "../test-safety.js";

interface ErrorTest {
  name: string;
  command: string;
  expectedExitCode: number;
  validation: (
    output: string,
    exitCode: number,
  ) => { passed: boolean; error?: string };
}

const tests: ErrorTest[] = [
  {
    name: "Invalid command shows helpful error",
    command: "aligntrue invalid-cmd",
    expectedExitCode: 2,
    validation: (output, exitCode) => ({
      passed:
        exitCode === 2 &&
        (output.includes("Unknown") || output.includes("invalid")),
      error: !output.includes("Unknown")
        ? "Error message not helpful"
        : undefined,
    }),
  },
  {
    name: "Missing required argument",
    command: "aligntrue pull",
    expectedExitCode: 2,
    validation: (output) => ({
      passed: output.includes("required") || output.includes("missing"),
      error: "Should indicate missing argument",
    }),
  },
  {
    name: "File not found error is clear",
    command: "aligntrue md /nonexistent/file.md",
    expectedExitCode: 3,
    validation: (output) => ({
      passed: output.includes("not found") || output.includes("ENOENT"),
      error: "Should indicate file not found",
    }),
  },
  {
    name: "Validation error has clear message",
    command: "aligntrue check",
    expectedExitCode: 1,
    validation: (output) => ({
      passed: output.includes("config") || output.includes("not found"),
      error: "Should explain validation failure",
    }),
  },
  {
    name: "Help text is accurate",
    command: "aligntrue --help",
    expectedExitCode: 0,
    validation: (output) => ({
      passed:
        output.includes("Usage") &&
        output.includes("Commands") &&
        output.includes("Options"),
      error: "Help text missing key sections",
    }),
  },
  {
    name: "Error messages include how to fix",
    command: "aligntrue sync",
    expectedExitCode: 1,
    validation: (output) => ({
      passed: output.includes("init") || output.includes("run"),
      error: "Should suggest how to fix",
    }),
  },
];

function runTest(
  test: ErrorTest,
  workspace: string,
): {
  passed: boolean;
  error?: string;
  output: string;
  exitCode: number;
} {
  console.log(`  Executing: ${test.command}`);
  let output = "";
  let exitCode = 0;

  try {
    output = execSync(test.command, {
      cwd: workspace,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch (err) {
    const execErr = err as ExecException;
    exitCode = execErr.status || 1;
    output = execErr.stdout?.toString() || execErr.stderr?.toString() || "";
  }

  console.log(`  Exit code: ${exitCode}`);

  const validation = test.validation(output, exitCode);

  // Check exit code matches expected
  if (exitCode !== test.expectedExitCode) {
    return {
      passed: false,
      error: `Exit code mismatch: expected ${test.expectedExitCode}, got ${exitCode}`,
      output,
      exitCode,
    };
  }

  return {
    passed: validation.passed,
    error: validation.error,
    output,
    exitCode,
  };
}

function main() {
  // Safety check: ensure tests run in isolated environment
  assertTestSafety();

  console.log("=== Layer 7: Error & UX ===\n");

  const tempLogDir = mkdtempSync(join(tmpdir(), "aligntrue-layer-7-log-"));
  try {
    const workspace = process.env.TEST_WORKSPACE || process.cwd();
    const results = tests.map((test) => {
      console.log(`Test: ${test.name}`);
      const result = runTest(test, workspace);
      console.log(`  ${result.passed ? "✓ PASS" : "✗ FAIL"}\n`);
      return { test, result };
    });

    const passed = results.filter((r) => r.result.passed).length;
    const failed = results.length - passed;

    console.log("\n=== Summary ===");
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    const logPath = join(tempLogDir, "layer-7-results.json");
    writeFileSync(
      logPath,
      JSON.stringify(
        {
          layer: 7,
          timestamp: new Date().toISOString(),
          results: results.map((r) => ({
            name: r.test.name,
            passed: r.result.passed,
            error: r.result.error,
            exitCode: r.result.exitCode,
          })),
        },
        null,
        2,
      ),
    );

    process.exit(failed > 0 ? 1 : 0);
  } finally {
    rmSync(tempLogDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main();
}

export { tests, runTest };
