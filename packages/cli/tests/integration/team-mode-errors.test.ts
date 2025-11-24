/**
 * Team mode error handling tests
 * Tests error messages and validation for team mode commands
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync } from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import * as clack from "@clack/prompts";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let testProjectContext: TestProjectContext; // Added this line
describe("Team Mode Error Handling", () => {
  let originalCwd: string;
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    testProjectContext = setupTestProject({ skipFiles: true }); // Modified this line
    testDir = testProjectContext.projectDir;
    process.chdir(testDir);

    // Mock process.exit to throw for testing
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Mock clack prompts
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.spinner).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    } as any);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testProjectContext.cleanup(); // Modified this line
    vi.restoreAllMocks();
  });

  describe("--accept-agent flag validation", () => {
    it("throws clear error when --accept-agent is missing value", async () => {
      // Create minimal AlignTrue setup
      writeFileSync(
        join(testProjectContext.aligntrueDir, "config.yaml"), // Modified this line
        `
exporters:
  - cursor
mode: solo
version: "1"
`,
      );
      writeFileSync(
        join(testProjectContext.aligntrueDir, ".rules.yaml"), // Modified this line
        `
id: test-rules
version: 1.0.0
spec_version: "1"
sections: []
`,
      );

      // Try sync with --accept-agent but no value
      await expect(sync(["--accept-agent"])).rejects.toThrow(
        "Flag --accept-agent requires a value",
      );
    });

    it("shows helpful error for invalid agent name", async () => {
      // Create minimal AlignTrue setup
      writeFileSync(
        join(testProjectContext.aligntrueDir, "config.yaml"), // Modified this line
        `
exporters:
  - cursor
mode: solo
version: "1"
`,
      );
      writeFileSync(
        join(testProjectContext.aligntrueDir, ".rules.yaml"), // Modified this line
        `
id: test-rules
version: 1.0.0
spec_version: "1"
sections: []
`,
      );

      // Try sync with invalid agent
      await expect(sync(["--accept-agent", "invalid-agent"])).rejects.toThrow();
    });
  });
});
