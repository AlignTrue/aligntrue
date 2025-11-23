import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeEditSourceContent } from "../../src/utils/edit-source-content-merger";
import * as fs from "fs";
import * as glob from "glob";
import * as extractRules from "../../src/utils/extract-rules";

// Mock fs, glob, and extract-rules
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("glob", () => ({
  globSync: vi.fn(),
}));

vi.mock("../../src/utils/extract-rules", () => ({
  backupFileToOverwrittenRules: vi.fn(),
}));

describe("mergeEditSourceContent", () => {
  const cwd = "/tmp/test";
  const oldSource = "AGENTS.md";
  const newSource = ".cursor/rules/*.mdc";

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  it("should merge content with keep-both strategy", async () => {
    // Setup
    vi.mocked(glob.globSync).mockImplementation((pattern) => {
      if (pattern === oldSource) return ["AGENTS.md"];
      if (pattern === newSource) return [".cursor/rules/test.mdc"];
      return [];
    });

    vi.mocked(fs.readFileSync).mockImplementation((path) => {
      if (String(path).endsWith("AGENTS.md")) return "# Old Content";
      if (String(path).endsWith("test.mdc")) return "# New Content";
      return "";
    });

    // Execute
    const result = await mergeEditSourceContent(
      oldSource,
      newSource,
      undefined,
      cwd,
      "keep-both",
    );

    // Verify
    expect(result.contentToMerge).toContain("# Old Content");
    expect(result.contentToMerge).toContain("# New Content");
    expect(result.contentToMerge).toContain("\n\n");
    expect(result.summary).toContain("Merged old and new");
  });

  it("should only keep new content with keep-new strategy", async () => {
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
    const result = await mergeEditSourceContent(
      oldSource,
      newSource,
      undefined,
      cwd,
      "keep-new",
    );

    // Verify
    expect(result.contentToMerge).toBe("# New Content");
    expect(result.backedUpFiles).toContain("AGENTS.md");
    expect(result.summary).toContain("Replaced with new content");
  });

  it("should keep existing IR content with keep-existing strategy", async () => {
    // Setup
    const currentIR = "# Current IR Content";
    vi.mocked(glob.globSync).mockImplementation((pattern) => {
      if (pattern === newSource) return [".cursor/rules/test.mdc"];
      return [];
    });

    vi.mocked(extractRules.backupFileToOverwrittenRules).mockReturnValue({
      backed_up: true,
      backup_path: "/tmp/backup/test.mdc",
    });

    // Execute
    const result = await mergeEditSourceContent(
      oldSource,
      newSource,
      currentIR,
      cwd,
      "keep-existing",
    );

    // Verify
    expect(result.contentToMerge).toBe(currentIR);
    expect(result.backedUpFiles).toContain(".cursor/rules/test.mdc");
    expect(result.summary).toContain("Preserved existing rules");
  });

  it("should handle multiple files in edit source", async () => {
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
    const result = await mergeEditSourceContent(
      undefined,
      newSource,
      undefined,
      cwd,
      "keep-new",
    );

    // Verify
    expect(result.contentToMerge).toContain("# Rule 1");
    expect(result.contentToMerge).toContain("# Rule 2");
  });

  it("should handle empty old edit source", async () => {
    // Setup
    vi.mocked(glob.globSync).mockImplementation((pattern) => {
      if (pattern === newSource) return ["test.mdc"];
      return [];
    });

    vi.mocked(fs.readFileSync).mockReturnValue("# New Content");

    // Execute
    const result = await mergeEditSourceContent(
      undefined, // No old source
      newSource,
      undefined,
      cwd,
      "keep-both",
    );

    // Verify
    expect(result.contentToMerge).toBe("# New Content");
  });
});
