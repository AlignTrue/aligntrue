/**
 * Sources Management Integration Tests
 *
 * Tests the sources command subcommands:
 * - sources list: Show rule files with section counts
 * - sources split: Split AGENTS.md into multiple files
 * - sources --help: Show help text
 *
 * Note: Skipped on Windows CI due to persistent file locking issues.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { sources } from "../../src/commands/sources.js";
import * as yaml from "yaml";
import * as clack from "@clack/prompts";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;
let exitCode: number | undefined;
let consoleOutput: string[];

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();
  originalCwd = process.cwd();
  exitCode = undefined;
  consoleOutput = [];

  // Create fresh test directory
  testProjectContext = setupTestProject({ skipFiles: true });
  TEST_DIR = testProjectContext.projectDir;

  // Change to test directory
  process.chdir(TEST_DIR);

  // Mock process.exit to capture exit code
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`process.exit(${code})`);
  });

  // Capture console output
  vi.spyOn(console, "log").mockImplementation((...args) => {
    consoleOutput.push(args.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...args) => {
    consoleOutput.push(args.join(" "));
  });

  // Mock clack prompts
  vi.mocked(clack.intro).mockImplementation(() => {});
  vi.mocked(clack.outro).mockImplementation(() => {});
  vi.mocked(clack.cancel).mockImplementation(() => {});
  vi.mocked(clack.isCancel).mockReturnValue(false);
  vi.mocked(clack.confirm).mockResolvedValue(true);
  vi.mocked(clack.text).mockResolvedValue(".aligntrue/rules");
  vi.mocked(clack.log).info.mockImplementation((...args: unknown[]) => {
    consoleOutput.push((args as string[]).join(" "));
  });
  vi.mocked(clack.log).warn.mockImplementation((...args: unknown[]) => {
    consoleOutput.push((args as string[]).join(" "));
  });
  vi.mocked(clack.log).error.mockImplementation((...args: unknown[]) => {
    consoleOutput.push((args as string[]).join(" "));
  });
  vi.mocked(clack.log).success.mockImplementation((...args: unknown[]) => {
    consoleOutput.push((args as string[]).join(" "));
  });
  vi.mocked(clack.log).step.mockImplementation((...args: unknown[]) => {
    consoleOutput.push((args as string[]).join(" "));
  });
  vi.mocked(clack.log).message.mockImplementation((...args: unknown[]) => {
    consoleOutput.push((args as string[]).join(" "));
  });
});

afterEach(async () => {
  process.chdir(originalCwd);
  await testProjectContext.cleanup();
  vi.restoreAllMocks();
});

/**
 * Helper to create basic config
 */
function createConfig() {
  const config = {
    sources: [{ type: "local", path: ".aligntrue/rules" }],
    exporters: ["cursor"],
  };
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
  writeFileSync(
    join(TEST_DIR, ".aligntrue", "config.yaml"),
    yaml.stringify(config),
    "utf-8",
  );
}

/**
 * Helper to create a rule file
 */
function createRule(filename: string, title: string, content: string) {
  const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
  mkdirSync(rulesDir, { recursive: true });

  const ruleContent = `---
title: "${title}"
original_source: test-template
---

# ${title}

${content}
`;
  writeFileSync(join(rulesDir, filename), ruleContent, "utf-8");
}

/**
 * Helper to create AGENTS.md with sections
 */
function createAgentsMd(sections: Array<{ heading: string; content: string }>) {
  let content = "";
  for (const section of sections) {
    content += `# ${section.heading}\n\n${section.content}\n\n`;
  }
  writeFileSync(join(TEST_DIR, "AGENTS.md"), content, "utf-8");
}

/**
 * Helper to execute sources command
 */
async function executeSources(args: string[] = []) {
  try {
    await sources(args);
  } catch {
    // Expected - command exits via process.exit
  }
}

describeSkipWindows("Sources Management Integration", () => {
  describe("sources --help", () => {
    it("shows help text", async () => {
      createConfig();

      await executeSources(["--help"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("sources");
      expect(output).toContain("list");
      expect(output).toContain("split");
    });

    it("shows help with -h flag", async () => {
      createConfig();

      await executeSources(["-h"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("sources");
    });
  });

  describe("sources list", () => {
    it("lists rule files with section counts", async () => {
      createConfig();
      createRule("testing.md", "Testing Guidelines", "Write tests first.");
      createRule("security.md", "Security Rules", "Validate all inputs.");

      await executeSources(["list"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("LOCAL");
      expect(output).toContain("Files: 2");
      expect(output).toContain(".aligntrue/rules");
    });

    it("shows message when no source files found", async () => {
      createConfig();
      // Create empty rules directory
      mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });

      await executeSources(["list"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("Files: 0");
    });

    it("shows source directory path", async () => {
      createConfig();
      createRule("global.md", "Global Rules", "Some content.");

      await executeSources(["list"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain(".aligntrue/rules");
    });

    it("shows line counts for files", async () => {
      createConfig();
      createRule(
        "big.md",
        "Big File",
        "Line 1\nLine 2\nLine 3\nLine 4\nLine 5",
      );

      await executeSources(["list"]);

      const output = consoleOutput.join("\n");
      // Should show line count info
      expect(output).toMatch(/lines|sections/i);
    });
  });

  describe("sources split", () => {
    it("splits AGENTS.md into separate files", async () => {
      createConfig();
      createAgentsMd([
        { heading: "Testing", content: "Write unit tests." },
        { heading: "Security", content: "Use HTTPS." },
        { heading: "Performance", content: "Optimize queries." },
      ]);

      await executeSources(["split", "--yes"]);

      // Verify files were created
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      expect(existsSync(join(rulesDir, "testing.md"))).toBe(true);
      expect(existsSync(join(rulesDir, "security.md"))).toBe(true);
      expect(existsSync(join(rulesDir, "performance.md"))).toBe(true);
    });

    it("creates files with correct content", async () => {
      createConfig();
      createAgentsMd([
        { heading: "Code Style", content: "Use consistent formatting." },
      ]);

      await executeSources(["split", "--yes"]);

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const content = readFileSync(join(rulesDir, "code-style.md"), "utf-8");
      expect(content).toContain("Code Style");
      expect(content).toContain("Use consistent formatting");
    });

    it("errors when AGENTS.md not found", async () => {
      createConfig();
      // Don't create AGENTS.md

      await executeSources(["split", "--yes"]);

      expect(exitCode).toBe(1);
      const output = consoleOutput.join("\n");
      expect(output).toMatch(/AGENTS.md.*not found/i);
    });

    it("handles AGENTS.md with no sections gracefully", async () => {
      createConfig();
      // Create empty AGENTS.md (no sections)
      writeFileSync(
        join(TEST_DIR, "AGENTS.md"),
        "No sections here.\n",
        "utf-8",
      );

      await executeSources(["split", "--yes"]);

      const output = consoleOutput.join("\n");
      expect(output).toMatch(/no sections|nothing to do/i);
    });

    it("converts heading to lowercase filename with dashes", async () => {
      createConfig();
      createAgentsMd([
        {
          heading: "API Guidelines For REST Services",
          content: "Use proper HTTP methods.",
        },
      ]);

      await executeSources(["split", "--yes"]);

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      // Heading should be converted to lowercase with dashes
      expect(
        existsSync(join(rulesDir, "api-guidelines-for-rest-services.md")),
      ).toBe(true);
    });

    it("reports number of files created", async () => {
      createConfig();
      createAgentsMd([
        { heading: "Rule 1", content: "Content 1" },
        { heading: "Rule 2", content: "Content 2" },
        { heading: "Rule 3", content: "Content 3" },
      ]);

      await executeSources(["split", "--yes"]);

      const output = consoleOutput.join("\n");
      expect(output).toMatch(/3.*files|created 3/i);
    });
  });

  describe("sources add (removed)", () => {
    it("shows unknown subcommand error for add (use aligntrue add instead)", async () => {
      createConfig();

      await executeSources(["add"]);

      expect(exitCode).toBe(1);
      const output = consoleOutput.join("\n");
      expect(output).toContain("Unknown subcommand");
    });
  });

  describe("error handling", () => {
    it("errors on unknown subcommand", async () => {
      createConfig();

      await executeSources(["unknown"]);

      expect(exitCode).toBe(1);
      const output = consoleOutput.join("\n");
      expect(output).toContain("Unknown subcommand");
    });
  });

  describe("file organization workflow", () => {
    it("list -> split -> list shows updated files", async () => {
      createConfig();

      // Create AGENTS.md to split
      createAgentsMd([
        { heading: "Testing", content: "Test content." },
        { heading: "Security", content: "Security content." },
      ]);

      // Split AGENTS.md
      await executeSources(["split", "--yes"]);
      consoleOutput = [];

      // List should now show the split files
      await executeSources(["list"]);

      const output = consoleOutput.join("\n");
      expect(output).toContain("LOCAL");
      expect(output).toContain("Files: 2");
    });

    it("preserves content integrity through split", async () => {
      createConfig();

      const originalContent =
        "This is important security guidance with special chars: <>&";
      createAgentsMd([
        { heading: "Security Guidelines", content: originalContent },
      ]);

      await executeSources(["split", "--yes"]);

      // Verify content is preserved
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const splitContent = readFileSync(
        join(rulesDir, "security-guidelines.md"),
        "utf-8",
      );
      expect(splitContent).toContain(originalContent);
    });

    it("creates backup in unified backup location", async () => {
      createConfig();
      createAgentsMd([{ heading: "Testing", content: "Write tests" }]);

      await executeSources(["split", "--yes"]);

      // Verify backup was created in unified location
      const backupDir = join(TEST_DIR, ".aligntrue", ".backups", "files");
      expect(existsSync(backupDir)).toBe(true);

      // Verify backup has .bak suffix
      const backupFiles = readdirSync(backupDir);
      expect(backupFiles.length).toBeGreaterThan(0);
      expect(backupFiles[0]).toMatch(/AGENTS.*\.bak$/);
    });
  });
});
