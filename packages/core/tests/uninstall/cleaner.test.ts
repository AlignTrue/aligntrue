import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { executeUninstall } from "../../src/uninstall/cleaner.js";
import type { DetectionResult } from "../../src/uninstall/types.js";

describe("uninstall cleaner", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(process.cwd(), `.cleaner-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createMinimalDetection(
    overrides: Partial<DetectionResult> = {},
  ): DetectionResult {
    return {
      isInstalled: true,
      aligntrueDir: join(tempDir, ".aligntrue"),
      configFiles: [],
      sourceFiles: [],
      exportedFiles: [],
      lockfile: null,
      backups: [],
      gitignoreEntries: [],
      ...overrides,
    };
  }

  describe("removeGitignoreEntries", () => {
    it("removes single marker section and tracks entries", async () => {
      // Create .aligntrue directory for backup
      mkdirSync(join(tempDir, ".aligntrue", ".backups"), { recursive: true });

      // Create .gitignore with one AlignTrue section
      writeFileSync(
        join(tempDir, ".gitignore"),
        `node_modules/
dist/

# START AlignTrue Generated Files
.cursor/rules/*.mdc
AGENTS.md
# END AlignTrue Generated Files

*.log
`,
        "utf-8",
      );

      const detection = createMinimalDetection({
        gitignoreEntries: [".cursor/rules/*.mdc", "AGENTS.md"],
      });

      const result = await executeUninstall(detection, {
        cwd: tempDir,
        dryRun: false,
        exportHandling: "skip",
        sourceHandling: "keep",
      });

      expect(result.success).toBe(true);
      expect(result.removedGitignoreEntries).toContain(".cursor/rules/*.mdc");
      expect(result.removedGitignoreEntries).toContain("AGENTS.md");

      const gitignoreContent = readFileSync(
        join(tempDir, ".gitignore"),
        "utf-8",
      );
      expect(gitignoreContent).toContain("node_modules/");
      expect(gitignoreContent).toContain("*.log");
      expect(gitignoreContent).not.toContain("START AlignTrue");
      expect(gitignoreContent).not.toContain(".cursor/rules/*.mdc");
    });

    it("tracks entries from ALL duplicate marker sections (regression test)", async () => {
      // This test verifies the fix for the bug where regex.exec() only found
      // the first match, but replace() removed all matches, causing entries
      // from duplicate sections to be silently lost.

      // Create .aligntrue directory for backup
      mkdirSync(join(tempDir, ".aligntrue", ".backups"), { recursive: true });

      // Create .gitignore with DUPLICATE AlignTrue sections (can happen from
      // multiple syncs, manual edits, or merges)
      writeFileSync(
        join(tempDir, ".gitignore"),
        `node_modules/

# START AlignTrue Generated Files
.cursor/rules/*.mdc
AGENTS.md
# END AlignTrue Generated Files

some_other_stuff/

# START AlignTrue Generated Files
.clinerules/
.augment/rules/*.md
# END AlignTrue Generated Files

*.log
`,
        "utf-8",
      );

      const detection = createMinimalDetection({
        gitignoreEntries: [
          ".cursor/rules/*.mdc",
          "AGENTS.md",
          ".clinerules/",
          ".augment/rules/*.md",
        ],
      });

      const result = await executeUninstall(detection, {
        cwd: tempDir,
        dryRun: false,
        exportHandling: "skip",
        sourceHandling: "keep",
      });

      expect(result.success).toBe(true);

      // CRITICAL: All entries from BOTH sections must be tracked
      expect(result.removedGitignoreEntries).toContain(".cursor/rules/*.mdc");
      expect(result.removedGitignoreEntries).toContain("AGENTS.md");
      expect(result.removedGitignoreEntries).toContain(".clinerules/");
      expect(result.removedGitignoreEntries).toContain(".augment/rules/*.md");
      expect(result.removedGitignoreEntries).toHaveLength(4);

      // Both sections should be removed
      const gitignoreContent = readFileSync(
        join(tempDir, ".gitignore"),
        "utf-8",
      );
      expect(gitignoreContent).toContain("node_modules/");
      expect(gitignoreContent).toContain("some_other_stuff/");
      expect(gitignoreContent).toContain("*.log");
      expect(gitignoreContent).not.toContain("START AlignTrue");
      expect(gitignoreContent).not.toContain(".cursor/rules/*.mdc");
      expect(gitignoreContent).not.toContain(".clinerules/");
    });

    it("handles multiple different marker types", async () => {
      // Create .aligntrue directory for backup
      mkdirSync(join(tempDir, ".aligntrue", ".backups"), { recursive: true });

      // Create .gitignore with multiple different marker types
      writeFileSync(
        join(tempDir, ".gitignore"),
        `node_modules/

# START AlignTrue Generated Files
.cursor/rules/*.mdc
# END AlignTrue Generated Files

# START AlignTrue Gitignored Rules
.aligntrue/rules/private.md
# END AlignTrue Gitignored Rules

*.log
`,
        "utf-8",
      );

      const detection = createMinimalDetection({
        gitignoreEntries: [
          ".cursor/rules/*.mdc",
          ".aligntrue/rules/private.md",
        ],
      });

      const result = await executeUninstall(detection, {
        cwd: tempDir,
        dryRun: false,
        exportHandling: "skip",
        sourceHandling: "keep",
      });

      expect(result.success).toBe(true);
      expect(result.removedGitignoreEntries).toContain(".cursor/rules/*.mdc");
      expect(result.removedGitignoreEntries).toContain(
        ".aligntrue/rules/private.md",
      );

      const gitignoreContent = readFileSync(
        join(tempDir, ".gitignore"),
        "utf-8",
      );
      expect(gitignoreContent).not.toContain("START AlignTrue");
      expect(gitignoreContent).not.toContain("Gitignored Rules");
    });

    it("handles empty gitignore gracefully", async () => {
      // Create .aligntrue directory for backup
      mkdirSync(join(tempDir, ".aligntrue", ".backups"), { recursive: true });

      // No .gitignore file
      const detection = createMinimalDetection({
        gitignoreEntries: [],
      });

      const result = await executeUninstall(detection, {
        cwd: tempDir,
        dryRun: false,
        exportHandling: "skip",
        sourceHandling: "keep",
      });

      expect(result.success).toBe(true);
      expect(result.removedGitignoreEntries).toHaveLength(0);
    });
  });
});
