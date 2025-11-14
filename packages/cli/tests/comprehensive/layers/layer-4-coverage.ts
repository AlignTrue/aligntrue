/**
 * Layer 4: Command Coverage
 * Systematic breadth across all CLI commands
 */

import { execSync, type ExecException } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

interface CommandTest {
  command: string;
  description: string;
  expectedExitCode: number;
  requiresSetup?: boolean;
}

const commands: CommandTest[] = [
  {
    command: "aligntrue --help",
    description: "Show help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue --version",
    description: "Show version",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue init --help",
    description: "Init help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue sync --help",
    description: "Sync help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue check --help",
    description: "Check help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue team --help",
    description: "Team help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue drift --help",
    description: "Drift help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue backup --help",
    description: "Backup help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue revert --help",
    description: "Revert help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue config --help",
    description: "Config help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue adapters --help",
    description: "Adapters help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue plugs --help",
    description: "Plugs help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue scopes --help",
    description: "Scopes help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue override --help",
    description: "Override help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue pull --help",
    description: "Pull help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue link --help",
    description: "Link help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue watch --help",
    description: "Watch help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue md --help",
    description: "Markdown help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue telemetry --help",
    description: "Telemetry help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue privacy --help",
    description: "Privacy help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue update --help",
    description: "Update help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue onboard --help",
    description: "Onboard help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue migrate --help",
    description: "Migrate help",
    expectedExitCode: 0,
  },
];

function testCommand(
  test: CommandTest,
  workspace: string,
): {
  passed: boolean;
  output: string;
  exitCode: number;
} {
  let output = "";
  let exitCode = 0;

  try {
    output = execSync(test.command, {
      cwd: workspace,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5000,
    });
  } catch (err) {
    const execErr = err as ExecException;
    exitCode = execErr.status || 1;
    output = execErr.stdout?.toString() || execErr.stderr?.toString() || "";
  }

  const passed = exitCode === test.expectedExitCode;
  return { passed, output, exitCode };
}

function main() {
  console.log("=== Layer 4: Command Coverage ===\n");

  const tempLogDir = mkdtempSync(join(tmpdir(), "aligntrue-layer-4-log-"));
  try {
    const workspace = process.env.TEST_WORKSPACE || process.cwd();
    const results = commands.map((test) => {
      console.log(`Testing: ${test.description}`);
      console.log(`Executing: ${test.command}`);

      const result = testCommand(test, workspace);

      console.log(`Exit code: ${result.exitCode}`);
      console.log(`${result.passed ? "✓ PASS" : "✗ FAIL"}\n`);

      return { test, result };
    });

    const passed = results.filter((r) => r.result.passed).length;
    const failed = results.length - passed;

    console.log("\n=== Summary ===");
    console.log(`Total commands: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Coverage: ${Math.round((passed / results.length) * 100)}%`);

    const logPath = join(tempLogDir, "layer-4-results.json");
    writeFileSync(
      logPath,
      JSON.stringify(
        {
          layer: 4,
          timestamp: new Date().toISOString(),
          coverage: (passed / results.length) * 100,
          results: results.map((r) => ({
            command: r.test.command,
            description: r.test.description,
            passed: r.result.passed,
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

export { commands, testCommand };
