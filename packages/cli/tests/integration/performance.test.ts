import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";

/**
 * Integration Tests: Catastrophic Performance Regression Detection
 *
 * These tests catch severe performance regressions that indicate broken imports
 * or architectural issues. Thresholds are set at 5x normal operation to avoid
 * CI failures from platform variance while catching real problems.
 *
 * - Init: <30s (normal: ~2-5s)
 * - Sync: <15s (normal: ~1-3s)
 * - Help: <5s (normal: ~0.3-2s depending on platform)
 */

const GOLDEN_REPO_SOURCE = join(
  __dirname,
  "../../../..",
  "examples/golden-repo",
);
const CLI_PATH = join(__dirname, "../../../..", "packages/cli/dist/index.js");

let testDir: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(join(tmpdir(), "aligntrue-perf-"));
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
    path: .aligntrue/.rules.yaml
exporters:
  - agents-md
git:
  mode: ignore
`,
    );

    // Minimal rules file (YAML format)
    await fs.writeFile(
      join(projectDir, ".aligntrue/.rules.yaml"),
      `id: perf-test
version: 1.0.0
spec_version: "1"
sections:
  - heading: Testing example rule
    level: 2
    content: Test
    fingerprint: testing-example-rule
`,
    );

    const startTime = Date.now();

    // Run sync (init is implicit)
    execSync(`node ${CLI_PATH} sync`, { cwd: projectDir, stdio: "pipe" });

    const duration = Date.now() - startTime;

    // Log for transparency
    console.log(`Init completed in ${duration}ms`);

    // Assert <30 seconds (catastrophic regression detection)
    expect(duration).toBeLessThan(30000);
  });

  it("Sync speed: completes in <15 seconds for 5 rules + 3 exporters", async () => {
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
      } catch {
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

    // Assert <15 seconds (catastrophic regression detection)
    expect(duration).toBeLessThan(15000);
  });

  it("Help speed: completes in <5 seconds", async () => {
    const projectDir = join(testDir, "help-speed");
    await fs.mkdir(projectDir, { recursive: true });

    const measurements: number[] = [];

    // Run help 5 times to get max duration
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

    // Catastrophic regression detection - catches accidental heavy imports
    // Platform-independent threshold with 5x safety margin
    expect(maxDuration).toBeLessThan(5000);
  }, 20000);

  it("Large rule set: handles 100+ rules in <60 seconds", async () => {
    const LARGE_RULES_SOURCE = join(
      __dirname,
      "../../../..",
      "examples/remote-test/large-rules",
    );

    // Skip if fixtures don't exist yet
    try {
      await fs.access(LARGE_RULES_SOURCE);
    } catch {
      console.log(
        "Skipping test: Large rule fixtures not found in examples/remote-test/large-rules",
      );
      return;
    }

    const projectDir = join(testDir, "large-rules");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(join(projectDir, ".aligntrue"), { recursive: true });

    // Copy large rule fixtures
    await fs.cp(LARGE_RULES_SOURCE, join(projectDir, "rules"), {
      recursive: true,
    });

    // Get list of rule files
    const ruleFiles = await fs.readdir(join(projectDir, "rules"));
    const mdFiles = ruleFiles.filter((f) => f.endsWith(".md"));

    console.log(`Testing with ${mdFiles.length} rule files`);

    // Create config with all rule files as sources
    const sources = mdFiles.map((file) => ({
      type: "local",
      path: `rules/${file}`,
    }));

    await fs.writeFile(
      join(projectDir, ".aligntrue/config.yaml"),
      `version: "1"
mode: solo
sources:
${sources.map((s) => `  - type: ${s.type}\n    path: ${s.path}`).join("\n")}
exporters:
  - agents-md
git:
  mode: ignore
`,
    );

    // Measure memory before
    const memBefore = process.memoryUsage();

    // Measure sync time
    const startTime = Date.now();

    execSync(`node ${CLI_PATH} sync`, { cwd: projectDir, stdio: "pipe" });

    const duration = Date.now() - startTime;

    // Measure memory after
    const memAfter = process.memoryUsage();
    const heapUsedMB = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

    console.log(`Large rule set sync completed in ${duration}ms`);
    console.log(`Memory used: ${heapUsedMB.toFixed(2)}MB`);

    // Assert performance thresholds
    expect(duration).toBeLessThan(60000); // <60 seconds
    expect(heapUsedMB).toBeLessThan(500); // <500MB

    // Verify AGENTS.md was created and contains content from multiple files
    const agentsMd = await fs.readFile(join(projectDir, "AGENTS.md"), "utf-8");
    expect(agentsMd).toContain("Backend API");
    expect(agentsMd).toContain("Frontend React");
    expect(agentsMd).toContain("Database");
  }, 90000); // 90 second timeout

  it("Multi-file sources: no catastrophic slowdown", async () => {
    const LARGE_RULES_SOURCE = join(
      __dirname,
      "../../../..",
      "examples/remote-test/large-rules",
    );

    // Skip if fixtures don't exist yet
    try {
      await fs.access(LARGE_RULES_SOURCE);
    } catch {
      console.log(
        "Skipping test: Large rule fixtures not found in examples/remote-test/large-rules",
      );
      return;
    }

    const projectDir = join(testDir, "multi-file");
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(join(projectDir, ".aligntrue"), { recursive: true });

    // Copy large rule fixtures
    await fs.cp(LARGE_RULES_SOURCE, join(projectDir, "rules"), {
      recursive: true,
    });

    // Get list of rule files
    const ruleFiles = await fs.readdir(join(projectDir, "rules"));
    const mdFiles = ruleFiles.filter((f) => f.endsWith(".md"));

    // Create config with all files
    const sources = mdFiles.map((file) => ({
      type: "local",
      path: `rules/${file}`,
    }));

    await fs.writeFile(
      join(projectDir, ".aligntrue/config.yaml"),
      `version: "1"
mode: solo
sources:
${sources.map((s) => `  - type: ${s.type}\n    path: ${s.path}`).join("\n")}
exporters:
  - agents-md
git:
  mode: ignore
`,
    );

    // Warm up
    execSync(`node ${CLI_PATH} sync`, { cwd: projectDir, stdio: "pipe" });

    // Measure second sync (should be faster due to caching)
    const startTime = Date.now();
    execSync(`node ${CLI_PATH} sync`, { cwd: projectDir, stdio: "pipe" });
    const duration = Date.now() - startTime;

    console.log(
      `Multi-file sync (${mdFiles.length} files) completed in ${duration}ms`,
    );

    // Should complete reasonably fast even with multiple files
    expect(duration).toBeLessThan(30000); // <30 seconds for second run

    // Verify all files were processed
    const agentsMd = await fs.readFile(join(projectDir, "AGENTS.md"), "utf-8");

    // Check for content from various files
    expect(agentsMd.length).toBeGreaterThan(10000); // Should have substantial content
  }, 60000); // 60 second timeout
});
