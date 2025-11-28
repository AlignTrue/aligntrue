/**
 * Plugs System Full-Flow Integration Tests
 *
 * Tests the plugs system behavior in CLI commands:
 * 1. Rules without plugs export correctly
 * 2. Rules with plug syntax are exported
 * 3. Plugs command exists and provides help
 *
 * Note: Skipped on Windows CI due to persistent file locking issues
 *
 * NOTE: Full plug resolution from individual markdown frontmatter is tested
 * at the unit level in packages/core/tests/plugs/. This integration test
 * focuses on the CLI command behavior with rules that may contain plugs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
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
  // Restore cwd
  process.chdir(originalCwd);

  // Cleanup
  await testProjectContext.cleanup();
});

describeSkipWindows("Plugs System Integration", () => {
  describe("Rules Without Plugs", () => {
    it("exports rules without plugs correctly", async () => {
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      for (const file of readdirSync(rulesDir)) {
        unlinkSync(join(rulesDir, file));
      }

      writeFileSync(
        join(rulesDir, "no-plugs.md"),
        `---
title: No Plugs Rule
---

# No Plugs Rule

This rule has no plugs at all.
`,
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const cursorFile = join(TEST_DIR, ".cursor", "rules", "no-plugs.mdc");
      expect(existsSync(cursorFile)).toBe(true);

      const content = readFileSync(cursorFile, "utf-8");
      expect(content).toContain("No Plugs Rule");
    });
  });

  describe("Rules With Plug Syntax", () => {
    it("exports rules containing plug placeholders", async () => {
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      for (const file of readdirSync(rulesDir)) {
        unlinkSync(join(rulesDir, file));
      }

      writeFileSync(
        join(rulesDir, "with-plugs.md"),
        `---
title: Rule With Plug Syntax
---

# Rule With Plug Syntax

Run [[plug:test.cmd]] to verify.
`,
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const cursorFile = join(TEST_DIR, ".cursor", "rules", "with-plugs.mdc");
      expect(existsSync(cursorFile)).toBe(true);

      const content = readFileSync(cursorFile, "utf-8");
      // Rule should be exported (plug resolution is handled separately)
      expect(content).toContain("Rule With Plug Syntax");
    });
  });

  describe("Plugs Command", () => {
    it("plugs help command exists", async () => {
      const { plugsCommand } = await import("../../src/commands/plugs.js");

      // Should not throw when showing help
      try {
        await plugsCommand(["--help"]);
      } catch {
        // May throw from process.exit(0) for help
      }
    });
  });

  describe("Multiple Exporters", () => {
    it("exports to multiple exporters correctly", async () => {
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor", "agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      for (const file of readdirSync(rulesDir)) {
        unlinkSync(join(rulesDir, file));
      }

      writeFileSync(
        join(rulesDir, "multi-export.md"),
        `---
title: Multi-Export Rule
---

# Multi-Export Rule

This rule should export to both cursor and agents.
`,
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify both exports exist
      const cursorFile = join(TEST_DIR, ".cursor", "rules", "multi-export.mdc");
      const agentsFile = join(TEST_DIR, "AGENTS.md");

      expect(existsSync(cursorFile)).toBe(true);
      expect(existsSync(agentsFile)).toBe(true);
    });
  });
});
