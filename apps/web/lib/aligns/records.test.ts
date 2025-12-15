import { describe, expect, it } from "vitest";

import { buildSingleRuleRecord, buildCatalogPackRecord } from "./records";
import type { AlignRecord } from "./types";

describe("buildSingleRuleRecord", () => {
  it("creates single rule record", () => {
    const now = "2024-01-01T00:00:00.000Z";
    const record = buildSingleRuleRecord({
      id: "rule-1",
      sourceUrl: "https://github.com/org/repo/blob/main/rules/rule.md",
      normalizedUrl: "https://github.com/org/repo/blob/main/rules/rule.md",
      meta: {
        title: "Rule title",
        description: "Desc",
        author: "@org",
        fileType: "markdown",
        kind: "rule",
      },
      existing: null,
      now,
      contentHash: "hash",
      contentHashUpdatedAt: now,
    });

    expect(record.kind).toBe("rule");
    expect(record.source).toBe("github");
    expect(record.fileType).toBe("markdown");
    expect(record.createdAt).toBe(now);
    expect(record.lastViewedAt).toBe(now);
    expect(record.contentHash).toBe("hash");
  });

  it("preserves existing counts", () => {
    const now = "2024-02-01T00:00:00.000Z";
    const existing: AlignRecord = {
      id: "rule-1",
      url: "https://github.com/org/repo/blob/main/rules/rule.md",
      normalizedUrl: "https://github.com/org/repo/blob/main/rules/rule.md",
      provider: "github",
      source: "github",
      kind: "rule",
      title: "Old",
      description: null,
      author: null,
      fileType: "markdown",
      createdAt: "2023-12-01T00:00:00.000Z",
      lastViewedAt: "2023-12-15T00:00:00.000Z",
      viewCount: 2,
      installClickCount: 1,
    };

    const record = buildSingleRuleRecord({
      id: "rule-1",
      sourceUrl: existing.url,
      normalizedUrl: existing.normalizedUrl,
      meta: {
        title: "New",
        description: "Desc",
        author: "@org",
        fileType: "markdown",
        kind: "rule",
      },
      existing,
      now,
      contentHash: "hash",
      contentHashUpdatedAt: now,
    });

    expect(record.createdAt).toBe(existing.createdAt);
    expect(record.viewCount).toBe(existing.viewCount);
    expect(record.installClickCount).toBe(existing.installClickCount);
  });
});

describe("buildCatalogPackRecord", () => {
  it("creates catalog-origin pack with containsAlignIds", () => {
    const now = new Date().toISOString();

    const record = buildCatalogPackRecord({
      id: "pack-1",
      title: "Align Pack",
      description: "Desc",
      author: "@author",
      ruleIds: ["rule-1", "rule-2"],
      now,
      existing: null,
    });

    expect(record.source).toBe("catalog");
    expect(record.kind).toBe("pack");
    expect(record.fileType).toBe("unknown");
    expect(record.containsAlignIds).toEqual(["rule-1", "rule-2"]);
    expect(record.pack?.files).toEqual([]);
  });

  it("preserves counters when existing record is provided", () => {
    const now = new Date().toISOString();
    const existing: AlignRecord = {
      id: "pack-1",
      url: "https://aligntrue.ai/a/pack-1",
      normalizedUrl: "https://aligntrue.ai/a/pack-1",
      provider: "unknown",
      source: "catalog",
      kind: "pack",
      title: "Old title",
      description: "Old desc",
      author: null,
      fileType: "unknown",
      createdAt: "2023-12-01T00:00:00.000Z",
      lastViewedAt: "2023-12-15T00:00:00.000Z",
      viewCount: 5,
      installClickCount: 3,
      pack: { files: [], totalBytes: 0 },
      containsAlignIds: ["rule-1"],
    };

    const record = buildCatalogPackRecord({
      id: "pack-1",
      title: "Align Pack",
      description: "Desc",
      author: "@author",
      ruleIds: ["rule-1", "rule-2"],
      now,
      existing,
    });

    expect(record.createdAt).toBe(existing.createdAt);
    expect(record.viewCount).toBe(existing.viewCount);
    expect(record.installClickCount).toBe(existing.installClickCount);
    expect(record.containsAlignIds).toEqual(["rule-1", "rule-2"]);
  });
});
