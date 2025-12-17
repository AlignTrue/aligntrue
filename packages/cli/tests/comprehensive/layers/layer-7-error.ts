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
  /** Whether the test requires a clean workspace with no prior state */
  needsCleanWorkspace?: boolean;
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
        (output.includes("Command not implemented") || output.includes("not")),
      error: !output.includes("not") ? "Error message not helpful" : undefined,
    }),
  },
  {
    name: "Missing required argument for add command",
    command: "aligntrue add",
    expectedExitCode: 2,
    validation: (output) => ({
      passed:
        output.includes("required") ||
        output.includes("Missing") ||
        output.includes("url"),
      error: "Should indicate missing argument",
    }),
  },
  {
    name: "Non-existent command error is clear",
    command: "aligntrue nonexistent-command",
    expectedExitCode: 2,
    validation: (output) => ({
      passed:
        output.includes("not implemented") || output.includes("Command not"),
      error: "Should indicate command not found",
    }),
  },
  {
    name: "Validation error has clear message",
    command: "aligntrue check",
    expectedExitCode: 2,
    needsCleanWorkspace: true,
    validation: (output) => ({
      passed: output.includes("Config") || output.includes("not found"),
      error: "Should explain validation failure",
    }),
  },
  {
    name: "Help text is accurate",
    command: "aligntrue --help",
    expectedExitCode: 0,
    validation: (output) => ({
      passed: output.includes("Usage") && output.includes("Commands"),
      error: "Help text missing key sections",
    }),
  },
  {
    name: "Error messages are clear and actionable",
    command: "aligntrue sync",
    expectedExitCode: 2,
    needsCleanWorkspace: true,
    validation: (output) => ({
      passed:
        output.includes("Configuration file not found") ||
        output.includes("config") ||
        output.includes("Sync failed"),
      error: "Should have clear error message",
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
  let testWorkspace = workspace;

  // Some tests require a clean workspace (no config/rules). Create a temp dir for them.
  if (test.needsCleanWorkspace) {
    testWorkspace = mkdtempSync(join(tmpdir(), "aligntrue-layer7-clean-"));
  }

  try {
    output = execSync(test.command, {
      cwd: testWorkspace,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch (err) {
    const execErr = err as ExecException;
    exitCode = execErr.status ?? 1;
    const stdout = typeof execErr.stdout === "string" ? execErr.stdout : "";
    const stderr = typeof execErr.stderr === "string" ? execErr.stderr : "";
    output = stdout + stderr;
  } finally {
    if (test.needsCleanWorkspace && testWorkspace !== workspace) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
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

// Run main if this is the entry point
try {
  main();
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
}

export { tests, runTest };
