import { describe, it, expect, vi, beforeEach } from "vitest";
import { prepareEditSourceSwitch } from "../../src/utils/edit-source-content-merger.js";
import * as fs from "fs";
import * as glob from "glob";
import * as extractRules from "../../src/utils/extract-rules.js";

// Mock fs, glob, and extract-rules
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("glob", () => ({
  globSync: vi.fn(),
}));

vi.mock("../../src/utils/extract-rules.js", () => ({
  backupFileToOverwrittenRules: vi.fn(),
}));

describe("prepareEditSourceSwitch", () => {
  const cwd = "/tmp/test";
  const oldSource = "AGENTS.md";
  const newSource = ".cursor/rules/*.mdc";

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it("should backup old source and read new content", async () => {
    // Setup
    vi.mocked(glob.globSync).mockImplementation((pattern) => {
      if (pattern === oldSource) return ["AGENTS.md"];
      if (pattern === newSource) return [".cursor/rules/test.mdc"];
      return [];
    });

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith("test.mdc")) return "# New Content";
      return "";
    });

    vi.mocked(extractRules.backupFileToOverwrittenRules).mockReturnValue({
      backed_up: true,
      backup_path: "/tmp/backup/AGENTS.md",
    });

    // Execute
    const result = await prepareEditSourceSwitch(oldSource, newSource, cwd);

    // Verify
    expect(result.content).toBe("# New Content");
    expect(result.backedUpFiles).toContain("AGENTS.md");
    expect(result.summary).toContain("Switched to new source");
  });

  it("should handle multiple files in new edit source", async () => {
    // Setup
    vi.mocked(glob.globSync).mockImplementation((pattern) => {
      if (pattern === newSource) return ["rule1.mdc", "rule2.mdc"];
      return [];
    });

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith("rule1.mdc")) return "# Rule 1";
      if (String(path).endsWith("rule2.mdc")) return "# Rule 2";
      return "";
    });

    // Execute
    const result = await prepareEditSourceSwitch(undefined, newSource, cwd);

    // Verify
    expect(result.content).toContain("# Rule 1");
    expect(result.content).toContain("# Rule 2");
  });

  it("should handle empty old edit source", async () => {
    // Setup
    vi.mocked(glob.globSync).mockImplementation((pattern) => {
      if (pattern === newSource) return ["test.mdc"];
      return [];
    });

    vi.mocked(fs.readFileSync).mockReturnValue("# New Content");

    // Execute
    const result = await prepareEditSourceSwitch(
      undefined, // No old source
      newSource,
      cwd,
    );

    // Verify
    expect(result.content).toBe("# New Content");
    expect(result.backedUpFiles).toHaveLength(0);
  });
});
