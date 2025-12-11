import { describe, expect, it } from "vitest";

import { buildPackAlignRecord } from "./records";
import type { AlignRecord } from "./types";
import type { WebPackResult } from "./pack-fetcher";

const basePack: WebPackResult = {
  manifestUrl: "https://github.com/org/repo/blob/main/.align.yaml",
  info: {
    manifestPath: ".align.yaml",
    manifestId: "demo-pack",
    manifestVersion: "1.0.0",
    manifestSummary: "Demo pack summary",
    manifestAuthor: "Jane Doe",
    manifestDescription: "Demo pack description",
    ref: "main",
    files: [{ path: "aligns/rule.md", size: 120 }],
    totalBytes: 120,
  },
  files: [],
};

describe("buildPackAlignRecord", () => {
  it("marks pack records as yaml files", () => {
    const now = "2024-01-01T00:00:00.000Z";
    const record = buildPackAlignRecord({
      id: "demo-pack-id",
      pack: basePack,
      sourceUrl: "https://github.com/org/repo",
      existing: null,
      now,
    });

    expect(record.fileType).toBe("yaml");
    expect(record.createdAt).toBe(now);
    expect(record.lastViewedAt).toBe(now);
    expect(record.title).toBe("Demo pack summary");
    expect(record.description).toBe("Demo pack description");
  });

  it("preserves existing counters and createdAt", () => {
    const now = "2024-02-01T00:00:00.000Z";
    const existing: AlignRecord = {
      schemaVersion: 1,
      id: "demo-pack-id",
      url: "https://github.com/org/repo",
      normalizedUrl: basePack.manifestUrl,
      provider: "github",
      kind: "pack",
      title: "Old title",
      description: "Old description",
      fileType: "yaml",
      createdAt: "2023-12-01T00:00:00.000Z",
      lastViewedAt: "2023-12-15T00:00:00.000Z",
      viewCount: 5,
      installClickCount: 2,
      pack: basePack.info,
    };

    const record = buildPackAlignRecord({
      id: "demo-pack-id",
      pack: basePack,
      sourceUrl: "https://github.com/org/repo",
      existing,
      now,
    });

    expect(record.createdAt).toBe(existing.createdAt);
    expect(record.viewCount).toBe(existing.viewCount);
    expect(record.installClickCount).toBe(existing.installClickCount);
  });
});
