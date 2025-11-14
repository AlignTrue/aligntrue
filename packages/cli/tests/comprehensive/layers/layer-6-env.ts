/**
 * Layer 6: Environment Matrix
 * Cross-platform and runtime validation
 */

import { execSync, type ExecException } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";

interface EnvTest {
  name: string;
  command: string;
  validation: (output: string) => { passed: boolean; error?: string };
}

const tests: EnvTest[] = [
  {
    name: "Platform detection",
    command: "node --version && echo $SHELL",
    validation: (output) => ({
      passed: output.includes("v") && output.length > 0,
    }),
  },
  {
    name: "Path separators work correctly",
    command: "aligntrue init --mode solo && ls .aligntrue",
    validation: (output) => ({
      passed: output.includes("config.yaml"),
    }),
  },
  {
    name: "Commands are scriptable",
    command:
      "aligntrue init --mode solo && aligntrue --version > version.txt && cat version.txt",
    validation: (output) => ({
      passed: /\d+\.\d+\.\d+/.test(output),
    }),
  },
  {
    name: "Deterministic output",
    command: "aligntrue --help",
    validation: (output) => ({
      passed: output.includes("Usage") && output.includes("Commands"),
    }),
  },
];

function runTest(
  test: EnvTest,
  workspace: string,
): {
  passed: boolean;
  error?: string;
  output: string;
} {
  console.log(`  Executing: ${test.command}`);
  let output = "";

  try {
    output = execSync(test.command, {
      cwd: workspace,
      encoding: "utf-8",
      stdio: "pipe",
      shell: true,
    });
  } catch (err) {
    const execErr = err as ExecException;
    output = execErr.stdout?.toString() || execErr.stderr?.toString() || "";
  }

  const validation = test.validation(output);

  return {
    passed: validation.passed,
    error: validation.error,
    output,
  };
}

function main() {
  console.log("=== Layer 6: Environment Matrix ===\n");
  console.log(`Platform: ${platform()}`);
  console.log(`Node: ${process.version}`);
  console.log(`Shell: ${process.env.SHELL || "unknown"}\n`);

  const tempLogDir = mkdtempSync(join(tmpdir(), "aligntrue-layer-6-log-"));
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

    const logPath = join(tempLogDir, "layer-6-results.json");
    writeFileSync(
      logPath,
      JSON.stringify(
        {
          layer: 6,
          timestamp: new Date().toISOString(),
          platform: platform(),
          node: process.version,
          results: results.map((r) => ({
            name: r.test.name,
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

export { tests, runTest };
