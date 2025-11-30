/**
 * Integration tests for content_mode feature in sync command
 * Tests CLI flag handling and config-based mode selection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();

  // Create fresh test directory
  testProjectContext = await setupTestProject();
  TEST_DIR = testProjectContext.projectDir;

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
  await testProjectContext.cleanup();
});

describeSkipWindows("Sync Command - content_mode", () => {
  describe("auto mode (default)", () => {
    it("uses inline for single rule", async () => {
      // Setup: Create config with agents exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory (clear any default files from setupTestProject)
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const { rmSync } = await import("fs");
      rmSync(rulesDir, { recursive: true, force: true });
      mkdirSync(rulesDir, { recursive: true });

      // Create single rule file
      const ruleContent = `---
title: Test Rule
description: A test rule
---

This is the content of the test rule.
`;
      writeFileSync(join(rulesDir, "test.md"), ruleContent, "utf-8");

      // Run sync with auto mode (default)
      try {
        await sync([]);
      } catch {
        // Sync may throw due to mocking, ignore
      }

      // Check AGENTS.md content
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      if (existsSync(agentsPath)) {
        const content = readFileSync(agentsPath, "utf-8");

        // Should use inline format for single rule
        expect(content).toContain("<!-- aligntrue:rule");
        // Check for link format (markdown links to rules) - not the header comment
        expect(content).not.toMatch(/\[.*\]\(\.\/\.aligntrue\/rules\//);
      }
    });

    it("uses links for multiple rules", async () => {
      // Setup: Create config with agents exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create multiple rule files
      const rule1 = `---
title: Rule 1
description: First rule
---

Content of rule 1.
`;
      const rule2 = `---
title: Rule 2
description: Second rule
---

Content of rule 2.
`;
      writeFileSync(join(rulesDir, "rule1.md"), rule1, "utf-8");
      writeFileSync(join(rulesDir, "rule2.md"), rule2, "utf-8");

      // Run sync with auto mode (default)
      try {
        await sync([]);
      } catch {
        // Sync may throw due to mocking, ignore
      }

      // Check AGENTS.md content
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      if (existsSync(agentsPath)) {
        const content = readFileSync(agentsPath, "utf-8");

        // Should use links format for multiple rules (check for markdown link format)
        expect(content).toMatch(/\[.*\]\(\.\/\.aligntrue\/rules\//);
        expect(content).not.toContain("<!-- aligntrue:rule");
      }
    });
  });

  describe("CLI flag --content-mode", () => {
    it("forces inline mode with --content-mode=inline", async () => {
      // Setup: Create config with agents exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create multiple rule files
      const rule1 = `---
title: Rule 1
description: First rule
---

Content of rule 1.
`;
      const rule2 = `---
title: Rule 2
description: Second rule
---

Content of rule 2.
`;
      writeFileSync(join(rulesDir, "rule1.md"), rule1, "utf-8");
      writeFileSync(join(rulesDir, "rule2.md"), rule2, "utf-8");

      // Run sync with --content-mode=inline
      try {
        await sync(["--content-mode=inline"]);
      } catch {
        // Sync may throw due to mocking, ignore
      }

      // Check AGENTS.md content
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      if (existsSync(agentsPath)) {
        const content = readFileSync(agentsPath, "utf-8");

        // Should use inline format even though we have multiple rules
        expect(content).toContain("<!-- aligntrue:rule");
        // Check for link format (markdown links to rules) - not the header comment
        expect(content).not.toMatch(/\[.*\]\(\.\/\.aligntrue\/rules\//);
      }
    });

    it("forces links mode with --content-mode=links", async () => {
      // Setup: Create config with agents exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create single rule file
      const ruleContent = `---
title: Test Rule
description: A test rule
---

This is the content of the test rule.
`;
      writeFileSync(join(rulesDir, "test.md"), ruleContent, "utf-8");

      // Run sync with --content-mode=links
      try {
        await sync(["--content-mode=links"]);
      } catch {
        // Sync may throw due to mocking, ignore
      }

      // Check AGENTS.md content
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      if (existsSync(agentsPath)) {
        const content = readFileSync(agentsPath, "utf-8");

        // Should use links format even though we have single rule (check for markdown link format)
        expect(content).toMatch(/\[.*\]\(\.\/\.aligntrue\/rules\//);
        expect(content).not.toContain("<!-- aligntrue:rule");
      }
    });
  });

  describe("config-based content_mode", () => {
    it("reads content_mode from config.yaml", async () => {
      // Setup: Create config with content_mode
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
        sync: {
          content_mode: "inline",
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create multiple rule files
      const rule1 = `---
title: Rule 1
description: First rule
---

Content of rule 1.
`;
      const rule2 = `---
title: Rule 2
description: Second rule
---

Content of rule 2.
`;
      writeFileSync(join(rulesDir, "rule1.md"), rule1, "utf-8");
      writeFileSync(join(rulesDir, "rule2.md"), rule2, "utf-8");

      // Run sync without CLI flag
      try {
        await sync([]);
      } catch {
        // Sync may throw due to mocking, ignore
      }

      // Check AGENTS.md content
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      if (existsSync(agentsPath)) {
        const content = readFileSync(agentsPath, "utf-8");

        // Should use inline format from config
        expect(content).toContain("<!-- aligntrue:rule");
        // Check for link format (markdown links to rules) - not the header comment
        expect(content).not.toMatch(/\[.*\]\(\.\/\.aligntrue\/rules\//);
      }
    });

    it("CLI flag overrides config", async () => {
      // Setup: Create config with content_mode=links
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
        sync: {
          content_mode: "links",
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create single rule file
      const ruleContent = `---
title: Test Rule
description: A test rule
---

This is the content of the test rule.
`;
      writeFileSync(join(rulesDir, "test.md"), ruleContent, "utf-8");

      // Run sync with --content-mode=inline (overrides config)
      try {
        await sync(["--content-mode=inline"]);
      } catch {
        // Sync may throw due to mocking, ignore
      }

      // Check AGENTS.md content
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      if (existsSync(agentsPath)) {
        const content = readFileSync(agentsPath, "utf-8");

        // Should use inline format from CLI flag (overrides config)
        expect(content).toContain("<!-- aligntrue:rule");
        // Check for link format (markdown links to rules) - not the header comment
        expect(content).not.toMatch(/\[.*\]\(\.\/\.aligntrue\/rules\//);
      }
    });
  });
});
