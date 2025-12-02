/**
 * Layer 1: Smoke Tests
 * Fast regression catch on install and basic commands
 */

import { execSync, type ExecException } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertTestSafety } from "../test-safety.js";

interface TestScenario {
  name: string;
  command: string;
  expectedExitCode: number;
  expectedOutput?: RegExp;
  maxDuration?: number; // milliseconds
}

const scenarios: TestScenario[] = [
  {
    name: "Help command responds quickly",
    command: "aligntrue --help",
    expectedExitCode: 0,
    expectedOutput: /Usage: aligntrue/,
    maxDuration: 1000,
  },
  {
    name: "Version command works",
    command: "aligntrue --version",
    expectedExitCode: 0,
    expectedOutput: /\d+\.\d+\.\d+/,
  },
  {
    name: "Check command handles missing config gracefully",
    command: "aligntrue check",
    expectedExitCode: 2,
    expectedOutput: /Config file not found/i,
  },
  {
    name: "Invalid command shows helpful error",
    command: "aligntrue invalid-command",
    expectedExitCode: 1,
    expectedOutput: /Command not implemented|not found/i,
  },
];

function runTest(scenario: TestScenario): {
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
} {
  const start = Date.now();
  let output = "";
  let exitCode = 0;
  let error: string | undefined;

  try {
    output = execSync(scenario.command, {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: scenario.maxDuration || 5000,
    });
  } catch (err) {
    const execErr = err as ExecException;
    exitCode = execErr.status ?? 1;
    output =
      (execErr.stdout?.toString() || "") + (execErr.stderr?.toString() || "");
    if (exitCode !== scenario.expectedExitCode) {
      error = `Exit code mismatch: expected ${scenario.expectedExitCode}, got ${exitCode}`;
    }
  }

  const duration = Date.now() - start;

  // Check exit code
  if (exitCode !== scenario.expectedExitCode && !error) {
    error = `Exit code mismatch: expected ${scenario.expectedExitCode}, got ${exitCode}`;
  }

  // Check output pattern
  if (scenario.expectedOutput && !scenario.expectedOutput.test(output)) {
    error = error || `Output pattern not found: ${scenario.expectedOutput}`;
  }

  // Check duration
  if (scenario.maxDuration && duration > scenario.maxDuration) {
    error =
      error || `Duration exceeded: ${duration}ms > ${scenario.maxDuration}ms`;
  }

  return {
    passed: !error,
    duration,
    output,
    error,
  };
}

function main() {
  // Safety check: ensure tests run in isolated environment
  assertTestSafety();

  const tempLogDir = mkdtempSync(join(tmpdir(), "aligntrue-layer-1-log-"));
  try {
    console.log("=== Layer 1: Smoke Tests ===\n");

    const results = scenarios.map((scenario) => {
      console.log(`Testing: ${scenario.name}`);
      console.log(`Executing: ${scenario.command}`);

      const result = runTest(scenario);

      console.log(`Exit code: ${result.passed ? 0 : 1}`);
      console.log(`Duration: ${result.duration}ms`);

      if (result.passed) {
        console.log("✓ PASS\n");
      } else {
        console.log(`✗ FAIL: ${result.error}\n`);
      }

      return { scenario, result };
    });

    // Summary
    const passed = results.filter((r) => r.result.passed).length;
    const failed = results.length - passed;

    console.log("\n=== Summary ===");
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    // Write results to log
    const logPath = join(tempLogDir, "layer-1-results.json");
    writeFileSync(
      logPath,
      JSON.stringify(
        {
          layer: 1,
          timestamp: new Date().toISOString(),
          results: results.map((r) => ({
            name: r.scenario.name,
            command: r.scenario.command,
            passed: r.result.passed,
            duration: r.result.duration,
            error: r.result.error,
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
void main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

export { scenarios, runTest };
