import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";

/**
 * Integration Tests: Performance Benchmarks
 *
 * These tests validate performance claims:
 * - Init speed: <10 seconds
 * - Sync speed: <5 seconds for 5 rules + 3 exporters
 * - Help speed: <450ms (with quality tooling: Husky, lint-staged, commitlint)
 */

const GOLDEN_REPO_SOURCE = join(
  __dirname,
  "../../../..",
  "examples/golden-repo",
);
const CLI_PATH = join(__dirname, "../../../..", "packages/cli/dist/index.js");

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `aligntrue-perf-${Date.now()}`);
  await fs.mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  if (testDir) {
    await fs.rm(testDir, { recursive: true, force: true });
  }
});

describe("Performance Benchmarks", () => {
  it("Init speed: completes in <10 seconds", async () => {
    const projectDir = join(testDir, "init-speed");
    await fs.mkdir(projectDir, { recursive: true });

    // Create minimal config to skip interactive prompts
    await fs.mkdir(join(projectDir, ".aligntrue"), { recursive: true });
    await fs.writeFile(
      join(projectDir, ".aligntrue/config.yaml"),
      `version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/rules.md
exporters:
  - cursor
git:
  mode: ignore
`,
    );

    // Minimal rules file
    await fs.writeFile(
      join(projectDir, ".aligntrue/rules.md"),
      `\`\`\`aligntrue
id: perf-test
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test
\`\`\`
`,
    );

    const startTime = Date.now();

    // Run sync (init is implicit)
    execSync(`node ${CLI_PATH} sync`, { cwd: projectDir, stdio: "pipe" });

    const duration = Date.now() - startTime;

    // Log for transparency
    console.log(`Init completed in ${duration}ms`);

    // Assert <10 seconds
    expect(duration).toBeLessThan(10000);
  });

  it("Sync speed: completes in <5 seconds for 5 rules + 3 exporters", async () => {
    // Setup golden repo
    const projectDir = join(testDir, "sync-speed");
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, { recursive: true });

    // Also copy hidden directories that fs.cp might miss
    const hiddenDirs = [".aligntrue", ".cursor", ".vscode"];
    for (const dir of hiddenDirs) {
      const srcDir = join(GOLDEN_REPO_SOURCE, dir);
      const dstDir = join(projectDir, dir);
      try {
        await fs.cp(srcDir, dstDir, { recursive: true });
      } catch (err) {
        // Directory might not exist, continue
      }
    }

    // Warm up (first run may be slower due to Node loading)
    execSync(`node ${CLI_PATH} sync`, { cwd: projectDir, stdio: "pipe" });

    // Measure second sync
    const startTime = Date.now();

    execSync(`node ${CLI_PATH} sync`, { cwd: projectDir, stdio: "pipe" });

    const duration = Date.now() - startTime;

    console.log(`Sync completed in ${duration}ms`);

    // Assert <5 seconds
    expect(duration).toBeLessThan(5000);
  });

  it("Help speed: completes in <450ms (with quality tooling)", async () => {
    const projectDir = join(testDir, "help-speed");
    await fs.mkdir(projectDir, { recursive: true });

    const measurements: number[] = [];

    // Run help 5 times to average
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();

      execSync(`node ${CLI_PATH} --help`, { cwd: projectDir, stdio: "pipe" });

      const duration = Date.now() - startTime;
      measurements.push(duration);
    }

    const avgDuration =
      measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const maxDuration = Math.max(...measurements);

    console.log(`Help avg: ${avgDuration.toFixed(0)}ms, max: ${maxDuration}ms`);

    // Assert average <450ms (increased to account for CI environment variance)
    expect(avgDuration).toBeLessThan(450);

    // Allow individual runs up to 500ms (CI environments may be slower)
    expect(maxDuration).toBeLessThan(500);
  });
});
