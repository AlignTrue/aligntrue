/**
 * Layer 4: Command Coverage
 * Systematic breadth across all CLI commands
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertTestSafety } from "../test-safety.js";

interface CommandTest {
  command: string;
  description: string;
  expectedExitCode: number | "nonZero";
  requiresSetup?: boolean;
  expectedOutputIncludes?: string[];
  input?: string;
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
    command: "aligntrue exporters --help",
    description: "Exporters help",
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
    command: "aligntrue sources --help",
    description: "Sources help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue status --help",
    description: "Status help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue doctor --help",
    description: "Doctor help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue add --help",
    description: "Add help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue remove --help",
    description: "Remove help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue rules --help",
    description: "Rules help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue remotes --help",
    description: "Remotes help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue uninstall --help",
    description: "Uninstall help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue override --help",
    description: "Override help",
    expectedExitCode: 0,
  },
  {
    command: "aligntrue privacy --help",
    description: "Privacy help",
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
  {
    command: "aligntrue status",
    description: "Status after init",
    expectedExitCode: 0,
    requiresSetup: true,
    expectedOutputIncludes: ["Exporters"],
  },
  {
    command: "aligntrue doctor",
    description: "Doctor after init",
    expectedExitCode: 0,
    requiresSetup: true,
  },
  {
    command: "aligntrue onboard --ci",
    description: "Onboard CI missing SARIF",
    expectedExitCode: "nonZero",
    requiresSetup: true,
    input: "",
  },
  {
    command: "aligntrue plugs",
    description: "Plugs status after init",
    expectedExitCode: 0,
    requiresSetup: true,
  },
  {
    command: "aligntrue plugs set",
    description: "Plugs set missing slot",
    expectedExitCode: "nonZero",
    requiresSetup: true,
  },
  {
    command: 'aligntrue plugs set test.cmd "/absolute/path"',
    description: "Plugs set invalid format",
    expectedExitCode: "nonZero",
    requiresSetup: true,
  },
  {
    command: "aligntrue backup list",
    description: "Backup list after init",
    expectedExitCode: 0,
    requiresSetup: true,
  },
  {
    command: "aligntrue backup cleanup",
    description: "Backup cleanup after init",
    expectedExitCode: 0,
    requiresSetup: true,
  },
  {
    command: "aligntrue rules list",
    description: "Rules list after init",
    expectedExitCode: 0,
    requiresSetup: true,
  },
  {
    command: "aligntrue remove",
    description: "Remove missing argument",
    expectedExitCode: "nonZero",
    requiresSetup: true,
  },
  {
    command: "aligntrue uninstall --non-interactive",
    description: "Uninstall non-interactive",
    expectedExitCode: 0,
    requiresSetup: true,
  },
  {
    command: "aligntrue add",
    description: "Add missing URL",
    expectedExitCode: "nonZero",
    requiresSetup: true,
  },
];

function testCommand(
  test: CommandTest,
  workspace: string,
): {
  passed: boolean;
  output: string;
  exitCode: number;
  exitCheck: boolean;
  outputCheck: boolean;
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
    const execErr = err as {
      status?: number | null;
      stdout?: string;
      stderr?: string;
    };
    exitCode = execErr.status ?? 1;
    const stdout = typeof execErr.stdout === "string" ? execErr.stdout : "";
    const stderr = typeof execErr.stderr === "string" ? execErr.stderr : "";
    output = stdout + stderr;
  }

  const exitPass =
    test.expectedExitCode === "nonZero"
      ? exitCode !== 0
      : exitCode === test.expectedExitCode;
  const outputPass = (test.expectedOutputIncludes || []).every((needle) =>
    output.includes(needle),
  );
  const passed = exitPass && outputPass;
  return {
    passed,
    output,
    exitCode,
    exitCheck: exitPass,
    outputCheck: outputPass,
  };
}

function main() {
  // Safety check: ensure tests run in isolated environment
  assertTestSafety();

  console.log("=== Layer 4: Command Coverage ===\n");

  const tempLogDir = mkdtempSync(join(tmpdir(), "aligntrue-layer-4-log-"));
  try {
    const workspace = process.env.TEST_WORKSPACE || process.cwd();
    const setupTests = commands.filter((t) => t.requiresSetup);
    const noSetupTests = commands.filter((t) => !t.requiresSetup);

    const runTests = (testList: CommandTest[]) =>
      testList.map((test) => {
        console.log(`Testing: ${test.description}`);
        console.log(`Executing: ${test.command}`);

        const result = testCommand(test, workspace);

        console.log(`Exit code: ${result.exitCode}`);
        if (!result.outputCheck && test.expectedOutputIncludes?.length) {
          console.log(
            `Output missing expected substring(s): ${test.expectedOutputIncludes.join(", ")}`,
          );
        }
        console.log(`${result.passed ? "✓ PASS" : "✗ FAIL"}\n`);

        return { test, result };
      });

    const initialResults = runTests(noSetupTests);

    let setupResults: ReturnType<typeof runTests> = [];
    if (setupTests.length > 0) {
      console.log("Setting up workspace for setup-dependent tests...");
      execSync("aligntrue init --yes", {
        cwd: workspace,
        stdio: "pipe",
        encoding: "utf-8",
        timeout: 10000,
      });
      setupResults = runTests(setupTests);
    }

    const results = [...initialResults, ...setupResults];

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

// Run main if this is the entry point
try {
  main();
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
}

export { commands, testCommand };
