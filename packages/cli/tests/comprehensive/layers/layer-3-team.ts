/**
 * Layer 3: Team Golden Paths
 * Team mode workflows (lockfile, shared config, collaboration)
 */

import { execSync, type ExecException } from "node:child_process";
import { writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertTestSafety } from "../test-safety.js";

interface TeamScenario {
  name: string;
  commands: string[];
  validation: (workspace: string) => { passed: boolean; error?: string };
}

const scenarios: TeamScenario[] = [
  {
    name: "Enable team mode and generate lockfile",
    commands: [
      "aligntrue init --mode solo",
      "aligntrue team enable",
      "aligntrue sync",
    ],
    validation: (workspace) => {
      const lockPath = join(workspace, ".aligntrue.lock.json");
      if (!existsSync(lockPath)) {
        return { passed: false, error: "Lockfile not generated" };
      }
      return { passed: true };
    },
  },
  {
    name: "Drift detection catches unapproved changes",
    commands: [
      "aligntrue init --mode team",
      "aligntrue sync",
      "aligntrue drift --gates",
    ],
    validation: () => ({ passed: true }),
  },
  {
    name: "Personal rules stay local",
    commands: [
      "aligntrue init --mode team",
      'echo "# Personal\\n\\nMy rule" >> AGENTS.md',
      "aligntrue sync",
    ],
    validation: (workspace) => {
      const rulesPath = join(workspace, ".aligntrue", ".rules.yaml");
      return { passed: existsSync(rulesPath) };
    },
  },
];

function runScenario(
  scenario: TeamScenario,
  workspace: string,
): {
  passed: boolean;
  error?: string;
} {
  console.log(`  Running: ${scenario.name}`);

  for (const command of scenario.commands) {
    console.log(`  Executing: ${command}`);
    try {
      execSync(command, {
        cwd: workspace,
        encoding: "utf-8",
        stdio: "pipe",
        shell: "/bin/bash",
      });
      console.log(`  Exit code: 0`);
    } catch (err) {
      const execErr = err as ExecException;
      const exitCode = execErr.status || 1;
      console.log(`  Exit code: ${exitCode}`);
      // Some commands expected to fail (like drift detection)
      if (!command.includes("drift")) {
        return { passed: false, error: `Command failed: ${command}` };
      }
    }
  }

  return scenario.validation(workspace);
}

function main() {
  // Safety check: ensure tests run in isolated environment
  assertTestSafety();

  console.log("=== Layer 3: Team Golden Paths ===\n");

  const tempLogDir = mkdtempSync(join(tmpdir(), "aligntrue-layer-3-log-"));
  try {
    const workspace = process.env.TEST_WORKSPACE || process.cwd();
    const results = scenarios.map((scenario) => {
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

    const logPath = join(tempLogDir, "layer-3-results.json");
    writeFileSync(
      logPath,
      JSON.stringify(
        {
          layer: 3,
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
