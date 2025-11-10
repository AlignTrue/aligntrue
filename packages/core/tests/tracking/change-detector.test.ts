/**
 * Tests for change detector strategy selection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import {
  ChangeDetector,
  formatChangesSummary,
} from "../../src/tracking/change-detector.js";

describe("ChangeDetector", () => {
  let tempDir: string;
  let detector: ChangeDetector;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));
    detector = new ChangeDetector(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("strategy selection", () => {
    it("uses git strategy when git is available", async () => {
      // Initialize git repo
      execSync("git init", { cwd: tempDir, stdio: "ignore" });
      execSync('git config user.email "test@example.com"', {
        cwd: tempDir,
        stdio: "ignore",
      });
      execSync('git config user.name "Test User"', {
        cwd: tempDir,
        stdio: "ignore",
      });

      const strategyName = await detector.getStrategyName();
      expect(strategyName).toBe("git");
    });

    it("uses content-hash strategy when git is not available", async () => {
      // Non-git directory
      const strategyName = await detector.getStrategyName();
      expect(strategyName).toBe("content-hash");
    });

    it("caches selected strategy", async () => {
      const strategy1 = await detector.getStrategyName();
      const strategy2 = await detector.getStrategyName();
      expect(strategy1).toBe(strategy2);
    });

    it("can reset strategy cache", async () => {
      await detector.getStrategyName();
      detector.resetStrategy();
      // Should work without error after reset
      const strategyName = await detector.getStrategyName();
      expect(strategyName).toBeDefined();
    });
  });

  describe("change detection", () => {
    it("detects changes using selected strategy", async () => {
      const markdown = `
## Testing

Run tests before commit.
`;
      writeFileSync(join(tempDir, "AGENTS.md"), markdown);

      const changes = await detector.detect("AGENTS.md");

      expect(changes.added).toHaveLength(1);
      expect(changes.added[0]!.heading).toBe("Testing");
    });

    it("saves checkpoint after detection", async () => {
      const markdown = `
## Testing

Run tests.
`;
      const filePath = "AGENTS.md";
      writeFileSync(join(tempDir, filePath), markdown);

      // First detection
      const firstChanges = await detector.detect(filePath);
      await detector.saveCheckpoint(filePath, firstChanges.added);

      // Second detection - should see no changes
      const secondChanges = await detector.detect(filePath);
      expect(secondChanges.unchanged).toHaveLength(1);
      expect(secondChanges.added).toHaveLength(0);
    });
  });
});

describe("formatChangesSummary", () => {
  it("formats added sections", () => {
    const changes = {
      added: [
        {
          heading: "Testing",
          level: 2,
          content: "Content",
          fingerprint: "testing-abc123",
          lineStart: 1,
          lineEnd: 3,
        },
      ],
      modified: [],
      unchanged: [],
      removed: [],
    };

    const summary = formatChangesSummary(changes);
    expect(summary).toContain("Added 1 section(s):");
    expect(summary).toContain("  + Testing");
  });

  it("formats modified sections", () => {
    const changes = {
      added: [],
      modified: [
        {
          heading: "Security",
          level: 2,
          content: "Content",
          fingerprint: "security-def456",
          lineStart: 4,
          lineEnd: 6,
        },
      ],
      unchanged: [],
      removed: [],
    };

    const summary = formatChangesSummary(changes);
    expect(summary).toContain("Modified 1 section(s):");
    expect(summary).toContain("  ~ Security");
  });

  it("formats removed sections", () => {
    const changes = {
      added: [],
      modified: [],
      unchanged: [],
      removed: ["old-section-abc123"],
    };

    const summary = formatChangesSummary(changes);
    expect(summary).toContain("Removed 1 section(s)");
  });

  it("formats no changes", () => {
    const changes = {
      added: [],
      modified: [],
      unchanged: [],
      removed: [],
    };

    const summary = formatChangesSummary(changes);
    expect(summary).toContain("No changes detected");
  });

  it("formats complex changes", () => {
    const changes = {
      added: [
        {
          heading: "New Section",
          level: 2,
          content: "",
          fingerprint: "new-abc",
          lineStart: 1,
          lineEnd: 2,
        },
      ],
      modified: [
        {
          heading: "Updated Section",
          level: 2,
          content: "",
          fingerprint: "updated-def",
          lineStart: 3,
          lineEnd: 4,
        },
      ],
      unchanged: [],
      removed: ["removed-ghi"],
    };

    const summary = formatChangesSummary(changes);
    expect(summary).toContain("Added 1 section(s):");
    expect(summary).toContain("Modified 1 section(s):");
    expect(summary).toContain("Removed 1 section(s)");
  });
});
