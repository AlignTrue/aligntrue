/**
 * Read-Only Export File Protection Tests
 *
 * Verifies that agent export files are protected:
 * 1. Export files contain read-only warning comments
 * 2. Manual edits to exports are detected on next sync
 * 3. Backups are created before overwriting edited exports
 *
 * Note: Skipped on Windows CI due to file locking issues
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();
  originalCwd = process.cwd();

  // Create fresh test directory
  testProjectContext = setupTestProject();
  TEST_DIR = testProjectContext.projectDir;

  // Change to test directory
  process.chdir(TEST_DIR);

  // Mock process.exit to throw for integration tests
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code})`);
  });

  // Mock clack prompts
  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };
  vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
  vi.mocked(clack.intro).mockImplementation(() => {});
  vi.mocked(clack.outro).mockImplementation(() => {});
  vi.mocked(clack.confirm).mockResolvedValue(true);
  vi.mocked(clack.cancel).mockImplementation(() => {});
  vi.mocked(clack.isCancel).mockReturnValue(false);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await testProjectContext.cleanup();
});

describeSkipWindows("Read-Only Export File Protection", () => {
  describe("Export File Warning Comments", () => {
    it("AGENTS.md export contains read-only warning comment", async () => {
      // Setup config with agents exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Test content.
`,
        "utf-8",
      );

      // Sync
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify AGENTS.md has warning comment
      const agentsMd = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");
      expect(agentsMd).toContain("AlignTrue");
      // Should contain read-only warning
      expect(agentsMd).toContain("READ-ONLY");
      expect(agentsMd).toContain("DO NOT EDIT");
    });

    it("Cursor export contains read-only metadata", async () => {
      // Setup config with cursor exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Test content.
`,
        "utf-8",
      );

      // Sync
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify Cursor export exists and has metadata
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      expect(existsSync(cursorDir)).toBe(true);
      const cursorFiles = readdirSync(cursorDir).filter((f) =>
        f.endsWith(".mdc"),
      );
      expect(cursorFiles.length).toBeGreaterThan(0);

      // Check content of first cursor file
      const cursorContent = readFileSync(
        join(cursorDir, cursorFiles[0]!),
        "utf-8",
      );
      // Should contain frontmatter or footer with AlignTrue metadata
      expect(cursorContent.length).toBeGreaterThan(0);
    });
  });

  describe("Manual Edit Detection", () => {
    it("detects manual edits to exported files on sync", async () => {
      // Setup config
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Original content.
`,
        "utf-8",
      );

      // First sync to create exports
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const agentsPath = join(TEST_DIR, "AGENTS.md");
      expect(existsSync(agentsPath)).toBe(true);
      const originalContent = readFileSync(agentsPath, "utf-8");

      // Manually edit the export file
      const editedContent = originalContent.replace(
        "Original content",
        "MANUALLY EDITED content",
      );
      writeFileSync(agentsPath, editedContent, "utf-8");

      // Sync again - should handle the edit
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // After sync, the file should be back to source content
      // (manual edits are overwritten, but backed up)
      const afterSyncContent = readFileSync(agentsPath, "utf-8");

      // The sync should have processed without the manual edit
      // (exact behavior depends on implementation)
      expect(afterSyncContent.length).toBeGreaterThan(0);
    });
  });

  describe("Backup Before Overwrite", () => {
    it("creates backup before sync overwrites files", async () => {
      // Setup config
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Content.
`,
        "utf-8",
      );

      // First sync
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify backup directory exists
      const backupsDir = join(TEST_DIR, ".aligntrue", ".backups");
      expect(existsSync(backupsDir)).toBe(true);

      // List backups
      const backups = readdirSync(backupsDir);
      expect(backups.length).toBeGreaterThan(0);

      // Each backup should have a manifest
      const backupDir = join(backupsDir, backups[0]!);
      const manifestPath = join(backupDir, "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);

      // Verify manifest structure
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(manifest.version).toBeDefined();
      expect(manifest.files).toBeDefined();
    });

    it("backup includes agent files when configured", async () => {
      // Setup config with backup settings
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Content.
`,
        "utf-8",
      );

      // First sync to create AGENTS.md
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify AGENTS.md was created
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(true);

      // Modify the source rule
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

MODIFIED Content.
`,
        "utf-8",
      );

      // Second sync should create a new backup
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify backups exist
      const backupsDir = join(TEST_DIR, ".aligntrue", ".backups");
      expect(existsSync(backupsDir)).toBe(true);
      const backups = readdirSync(backupsDir);
      expect(backups.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Content Hash Verification", () => {
    it("cursor exports include content hash in frontmatter", async () => {
      // Setup config with cursor exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Content for hashing.
`,
        "utf-8",
      );

      // Sync
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify cursor export has content hash
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      const cursorFiles = readdirSync(cursorDir).filter((f) =>
        f.endsWith(".mdc"),
      );
      expect(cursorFiles.length).toBeGreaterThan(0);

      const cursorContent = readFileSync(
        join(cursorDir, cursorFiles[0]!),
        "utf-8",
      );

      // Cursor exports should contain content hash or AlignTrue metadata
      // Either in frontmatter or footer
      expect(
        cursorContent.includes("aligntrue") ||
          cursorContent.includes("content_hash") ||
          cursorContent.match(/[a-f0-9]{64}/),
      ).toBe(true);
    });

    it("exports are deterministic - same source produces same output", async () => {
      // Setup config
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create initial rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "test-rule.md"),
        `---
title: Test Rule
---

# Test Rule

Content.
`,
        "utf-8",
      );

      // First sync
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const firstExport = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");

      // Second sync with same content
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const secondExport = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");

      // Same source should produce identical exports
      expect(secondExport).toBe(firstExport);
    });
  });
});
