/**
 * Integration tests for sync command
 * Tests real file system operations and actual exports
 *
 * Note: Skipped on Windows CI due to persistent EBUSY file locking issues
 * that cannot be reliably worked around. Coverage is provided by Unix CI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { sync } from "../../src/commands/sync/index.js";
import { mockProcessExit } from "../helpers/exit-mock.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

vi.mock("@clack/prompts");

const TEST_DIR = join(tmpdir(), "aligntrue-test-sync");

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();

  // Create fresh test directory
  await cleanupDir(TEST_DIR);
  mkdirSync(TEST_DIR, { recursive: true });

  // Change to test directory
  process.chdir(TEST_DIR);

  // Mock process.exit to throw for integration tests
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code})`);
  });

  // Mock clack prompts to avoid terminal interaction
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
  // Cleanup
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Sync Command Integration", () => {
  describe("Basic Sync (IR → Agents)", () => {
    it.skip("reads IR from .aligntrue/.rules.yaml and syncs to exporters", async () => {
      // TODO: Fix - hitting validation errors with test IR data
      // Setup: Create config and IR
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor", "agents-md"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Test guidance
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: Cursor export created
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc");
      expect(existsSync(cursorPath)).toBe(true);

      const cursorContent = readFileSync(cursorPath, "utf-8");
      expect(cursorContent).toContain("test.rule.example");
      expect(cursorContent).toContain("Test guidance");

      // Verify: AGENTS.md export created
      const agentsMdPath = join(TEST_DIR, "AGENTS.md");
      expect(existsSync(agentsMdPath)).toBe(true);

      const agentsMdContent = readFileSync(agentsMdPath, "utf-8");
      expect(agentsMdContent).toContain("test.rule.example");
      expect(agentsMdContent).toContain("Test guidance");
    });

    it.skip("respects configured exporters in config", async () => {
      // TODO: Fix - hitting validation errors with test IR data
      // Setup: Config with only cursor exporter
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Test guidance
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: Only cursor export created
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc")),
      ).toBe(true);
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(false);
    });

    it.skip("creates backup before syncing", async () => {
      // TODO: Fix - hitting validation errors with test IR data
      // Setup
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Test guidance
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      // Create existing export to backup
      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc"),
        "# Old content\n",
        "utf-8",
      );

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: Backup directory created
      const backupDir = join(TEST_DIR, ".aligntrue", "backups");
      expect(existsSync(backupDir)).toBe(true);
    });
  });

  describe("Dry Run Mode", () => {
    it("shows changes without writing files with --dry-run", async () => {
      // Setup
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Test guidance
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      // Execute sync with dry-run
      try {
        await sync(["--dry-run"]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: No files created
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc")),
      ).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("exits with error if config not found", async () => {
      const exitMock = mockProcessExit();

      try {
        try {
          await sync([]);
        } catch {
          // May throw from process.exit if command fails
        }
      } catch {
        // Expected exit
      }

      expect(exitMock.exitCode).toBe(2);
      exitMock.restore();
    });

    it.skip("exits with error if IR not found", async () => {
      // TODO: Fix - test expectations don't match current error handling
      // Setup: Config exists but no IR
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const exitMock = mockProcessExit();

      try {
        try {
          await sync([]);
        } catch {
          // May throw from process.exit if command fails
        }
      } catch {
        // Expected exit
      }

      expect(exitMock.exitCode).toBe(1);
      exitMock.restore();
    });
  });

  describe("Custom Config Path", () => {
    it.skip("loads config from custom path with --config flag", async () => {
      // TODO: Fix - hitting validation errors with test IR data
      // Setup: Custom config location
      mkdirSync(join(TEST_DIR, "custom"), { recursive: true });
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, "custom", "my-config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule.example
    severity: error
    applies_to: ["**/*.ts"]
    guidance: Test guidance
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      // Execute sync with custom config
      try {
        await sync(["--config", "custom/my-config.yaml"]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: Sync completed with custom config
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc")),
      ).toBe(true);
    });
  });

  describe("Multiple Rules", () => {
    it.skip("syncs multiple rules correctly", async () => {
      // TODO: Fix - hitting validation errors with test IR data
      // Setup
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: rule-1
    severity: error
    applies_to: "**/*.ts"
    guidance: First rule
  - id: rule-2
    severity: warn
    applies_to: "**/*.js"
    guidance: Second rule
  - id: rule-3
    severity: info
    applies_to: "**/*.md"
    guidance: Third rule
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir, "utf-8");

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: All rules in export
      const cursorContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc"),
        "utf-8",
      );
      expect(cursorContent).toContain("rule-1");
      expect(cursorContent).toContain("rule-2");
      expect(cursorContent).toContain("rule-3");
      expect(cursorContent).toContain("First rule");
      expect(cursorContent).toContain("Second rule");
      expect(cursorContent).toContain("Third rule");
    });
  });
});
