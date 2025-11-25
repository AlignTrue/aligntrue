/**
 * Layer 8: Exploratory
 * Find unknown unknowns after structured coverage
 */

import { execSync, type ExecException } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertTestSafety } from "../test-safety.js";

interface ExploratoryTest {
  name: string;
  probe: string;
  commands: string[];
  expectedBehavior: string;
  severity: "P0" | "P1" | "P2" | "P3";
}

const tests: ExploratoryTest[] = [
  {
    name: "Rapid mode switching",
    probe: "Does switching solo → team → solo corrupt state?",
    commands: [
      "aligntrue init --mode solo",
      "aligntrue sync",
      "aligntrue team enable",
      "aligntrue sync",
      "aligntrue team disable || true",
      "aligntrue sync",
    ],
    expectedBehavior: "State should remain consistent",
    severity: "P1",
  },
  {
    name: "Conflicting config changes",
    probe: "What happens with simultaneous config edits?",
    commands: [
      "aligntrue init --mode solo",
      'echo "test: value" >> .aligntrue/config.yaml',
      "aligntrue sync",
    ],
    expectedBehavior: "Should handle or warn about manual config edits",
    severity: "P2",
  },
  {
    name: "Partial file deletion mid-operation",
    probe: "Can we recover from interrupted operations?",
    commands: [
      "aligntrue init --mode solo",
      "aligntrue sync &",
      "sleep 0.1",
      "rm .aligntrue/rules || true",
      "wait",
      "aligntrue sync",
    ],
    expectedBehavior: "Should detect corruption and recover or fail gracefully",
    severity: "P1",
  },
  {
    name: "Empty AGENTS.md",
    probe: "How does sync handle empty input file?",
    commands: [
      "aligntrue init --mode solo",
      "echo '' > AGENTS.md",
      "aligntrue sync",
    ],
    expectedBehavior: "Should handle empty file gracefully",
    severity: "P2",
  },
  {
    name: "Very long section names",
    probe: "Can we handle edge case inputs?",
    commands: [
      "aligntrue init --mode solo",
      'echo "# $( printf "A%.0s" {1..1000})" >> AGENTS.md',
      "aligntrue sync",
    ],
    expectedBehavior: "Should handle or reject with clear error",
    severity: "P3",
  },
  {
    name: "Nested directory init",
    probe: "Does init work in subdirectories?",
    commands: [
      "mkdir -p deep/nested/dir",
      "cd deep/nested/dir",
      "aligntrue init --mode solo",
    ],
    expectedBehavior: "Should init in current directory or warn",
    severity: "P2",
  },
  {
    name: "Multiple init calls",
    probe: "What happens if init is called twice?",
    commands: ["aligntrue init --mode solo", "aligntrue init --mode solo"],
    expectedBehavior: "Should detect existing config and prompt or skip",
    severity: "P2",
  },
  {
    name: "Sync with no exporters",
    probe: "Does sync work with all exporters disabled?",
    commands: [
      "aligntrue init --mode solo --exporters none || aligntrue init --mode solo",
      "aligntrue adapters disable cursor || true",
      "aligntrue sync",
    ],
    expectedBehavior: "Should complete or warn about no exporters",
    severity: "P3",
  },
];

function runTest(
  test: ExploratoryTest,
  workspace: string,
): {
  passed: boolean;
  actualBehavior: string;
  unexpectedIssue?: string;
} {
  console.log(`  Probe: ${test.probe}`);
  let actualBehavior = "";
  let unexpectedIssue: string | undefined;

  for (const command of test.commands) {
    console.log(`  Executing: ${command}`);
    try {
      const output = execSync(command, {
        cwd: workspace,
        encoding: "utf-8",
        stdio: "pipe",
        shell: "/bin/bash",
        timeout: 10000,
      });
      actualBehavior += output + "\n";
    } catch (err) {
      const execErr = err as ExecException;
      const exitCode = execErr.code || 1;
      const output =
        execErr.stdout?.toString() || execErr.stderr?.toString() || "";
      actualBehavior += `Exit ${exitCode}: ${output}\n`;

      // Check for unexpected crashes
      if (output.includes("FATAL") || output.includes("Segmentation fault")) {
        unexpectedIssue = "Unexpected crash detected";
      }
    }
  }

  // Exploratory tests are about discovering issues, not pass/fail
  const passed = !unexpectedIssue;

  return {
    passed,
    actualBehavior: actualBehavior.trim(),
    unexpectedIssue,
  };
}

function main() {
  // Safety check: ensure tests run in isolated environment
  assertTestSafety();

  console.log("=== Layer 8: Exploratory ===\n");
  console.log("Note: Exploratory tests probe for unexpected behavior\n");

  const tempLogDir = mkdtempSync(join(tmpdir(), "aligntrue-layer-8-log-"));
  try {
    const workspace = process.env.TEST_WORKSPACE || process.cwd();
    const results = tests.map((test) => {
      console.log(`Test: ${test.name}`);
      const result = runTest(test, workspace);
      console.log(`  ${result.passed ? "✓ No issues" : "✗ Issue found"}\n`);
      return { test, result };
    });

    const issuesFound = results.filter((r) => !r.result.passed);

    console.log("\n=== Summary ===");
    console.log(`Total probes: ${results.length}`);
    console.log(`Issues found: ${issuesFound.length}`);

    if (issuesFound.length > 0) {
      console.log("\nIssues discovered:");
      for (const { test, result } of issuesFound) {
        console.log(
          `  - ${test.name} (${test.severity}): ${result.unexpectedIssue}`,
        );
      }
    }

    const logPath = join(tempLogDir, "layer-8-results.json");
    writeFileSync(
      logPath,
      JSON.stringify(
        {
          layer: 8,
          timestamp: new Date().toISOString(),
          results: results.map((r) => ({
            name: r.test.name,
            probe: r.test.probe,
            severity: r.test.severity,
            passed: r.result.passed,
            unexpectedIssue: r.result.unexpectedIssue,
            actualBehavior: r.result.actualBehavior.substring(0, 500),
          })),
        },
        null,
        2,
      ),
    );

    process.exit(issuesFound.length > 0 ? 1 : 0);
  } finally {
    rmSync(tempLogDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main();
}

export { tests, runTest };
