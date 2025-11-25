/**
 * Layer 5: Statefulness
 * Real-world persistence and migration scenarios
 */

import { execSync, type ExecException } from "node:child_process";
import {
  writeFileSync,
  unlinkSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertTestSafety } from "../test-safety.js";

interface StateScenario {
  name: string;
  setup: (workspace: string) => void;
  command: string;
  validation: (
    workspace: string,
    output: string,
    exitCode: number,
  ) => {
    passed: boolean;
    error?: string;
  };
}

const scenarios: StateScenario[] = [
  {
    name: "First run with no config",
    setup: () => {},
    command: "aligntrue check",
    validation: (_, __, exitCode) => ({
      passed: exitCode !== 0,
      error: exitCode === 0 ? "Should fail without config" : undefined,
    }),
  },
  {
    name: "Valid config works",
    setup: (workspace) => {
      execSync("aligntrue init --mode solo", { cwd: workspace, stdio: "pipe" });
    },
    command: "aligntrue check",
    validation: (_, __, exitCode) => ({
      passed: exitCode === 0,
      error: exitCode !== 0 ? "Should succeed with valid config" : undefined,
    }),
  },
  {
    name: "Corrupted config handled gracefully",
    setup: (workspace) => {
      const configPath = join(workspace, ".aligntrue", "config.yaml");
      writeFileSync(configPath, "invalid: yaml: content: [[[");
    },
    command: "aligntrue check",
    validation: (_, output, exitCode) => ({
      passed: exitCode !== 0 && output.includes("parse"),
      error: exitCode === 0 ? "Should fail with corrupted config" : undefined,
    }),
  },
  {
    name: "Missing config file",
    setup: (workspace) => {
      const configPath = join(workspace, ".aligntrue", "config.yaml");
      if (existsSync(configPath)) {
        unlinkSync(configPath);
      }
    },
    command: "aligntrue sync",
    validation: (_, __, exitCode) => ({
      passed: exitCode !== 0,
      error: exitCode === 0 ? "Should fail without config" : undefined,
    }),
  },
];

function runScenario(
  scenario: StateScenario,
  workspace: string,
): {
  passed: boolean;
  error?: string;
  output: string;
  exitCode: number;
} {
  console.log(`  Setup: ${scenario.name}`);
  scenario.setup(workspace);

  console.log(`  Executing: ${scenario.command}`);
  let output = "";
  let exitCode = 0;

  try {
    output = execSync(scenario.command, {
      cwd: workspace,
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch (err) {
    const execErr = err as ExecException;
    exitCode = execErr.code || 1;
    output = execErr.stdout?.toString() || execErr.stderr?.toString() || "";
  }

  console.log(`  Exit code: ${exitCode}`);

  const validation = scenario.validation(workspace, output, exitCode);

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

  console.log("=== Layer 5: Statefulness ===\n");

  const tempLogDir = mkdtempSync(join(tmpdir(), "aligntrue-layer-5-log-"));
  try {
    const workspace = process.env.TEST_WORKSPACE || process.cwd();
    const results = scenarios.map((scenario) => {
      console.log(`Scenario: ${scenario.name}`);
      const result = runScenario(scenario, workspace);
      console.log(`  ${result.passed ? "✓ PASS" : "✗ FAIL"}\n`);
      return { scenario, result };
    });

    const passed = results.filter((r) => r.result.passed).length;
    const failed = results.length - passed;

    console.log("\n=== Summary ===");
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    const logPath = join(tempLogDir, "layer-5-results.json");
    writeFileSync(
      logPath,
      JSON.stringify(
        {
          layer: 5,
          timestamp: new Date().toISOString(),
          results: results.map((r) => ({
            name: r.scenario.name,
            passed: r.result.passed,
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

if (require.main === module) {
  main();
}

export { scenarios, runScenario };
