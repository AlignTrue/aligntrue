import { describe, expect, it } from "vitest";

import { toAlignSummary } from "./transforms";
import type { AlignRecord } from "./types";

const baseRecord: AlignRecord = {
  id: "align-123",
  url: "https://github.com/org/repo/blob/main/rules/rule.md",
  normalizedUrl: "https://github.com/org/repo/blob/main/rules/rule.md",
  provider: "github",
  source: "github",
  kind: "rule",
  title: "Rule title",
  description: "Desc",
  author: "@org",
  fileType: "markdown",
  createdAt: "2024-01-01T00:00:00.000Z",
  lastViewedAt: "2024-01-01T00:00:00.000Z",
  viewCount: 0,
  installClickCount: 0,
};

describe("toAlignSummary", () => {
  it("computes display fields for github-origin rule", () => {
    const summary = toAlignSummary(baseRecord);
    expect(summary.displayAuthor).toBe("@org");
    expect(summary.displayAuthorUrl).toBe("https://github.com/org");
    expect(summary.displayFilename).toBe("rule.md");
    expect(summary.externalUrl).toBe(baseRecord.normalizedUrl);
  });

  it("computes display fields for catalog pack", () => {
    const catalogPack: AlignRecord = {
      ...baseRecord,
      id: "pack-1",
      source: "catalog",
      kind: "pack",
      author: "@author",
      normalizedUrl: "https://aligntrue.ai/a/pack-1",
      url: "https://aligntrue.ai/a/pack-1",
    };
    const summary = toAlignSummary(catalogPack);
    expect(summary.displayAuthor).toBe("@author");
    expect(summary.displayAuthorUrl).toBeNull();
    expect(summary.displayFilename).toBe("Catalog Pack");
    expect(summary.externalUrl).toBeNull();
  });
});
