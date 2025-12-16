import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "path";
import { existsSync, mkdirSync, rmSync } from "fs";

const fetchAlignRecordMock = vi.fn();

vi.mock("../../src/utils/catalog-client.js", () => ({
  fetchAlignRecord: fetchAlignRecordMock,
  fetchPackRuleRecords: vi.fn(),
}));

describe("catalog-import", () => {
  const testDir = join(__dirname, "..", "..", "..", "temp-catalog-import");
  const rulesDir = join(testDir, ".aligntrue", "rules");

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(rulesDir, { recursive: true });

    fetchAlignRecordMock.mockResolvedValue({
      kind: "rule",
      id: "rule-1",
      title: "Rule One",
      normalizedUrl:
        "https://raw.githubusercontent.com/example/repo/main/rule.md",
    });

    // Mock global fetch to return content that would break gray-matter parsing
    // unless we strip the frontmatter manually.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          "---\n" +
          "globs: *\n" + // invalid YAML for gray-matter default parser
          "---\n" +
          "Body content\n",
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    fetchAlignRecordMock.mockReset();
  });

  it("strips residual frontmatter when parsing fails", async () => {
    const { importFromCatalog } =
      await import("../../src/utils/catalog-import.js");

    const result = await importFromCatalog("rule-1", rulesDir, testDir);
    expect(result.rules).toHaveLength(1);
    const rule = result.rules[0];

    expect(rule.content.trimStart().startsWith("---")).toBe(false);
    expect(rule.frontmatter.title).toBe("Rule One");
  });
});
