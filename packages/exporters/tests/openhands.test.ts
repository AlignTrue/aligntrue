import { describe, it, expect } from "vitest";
import type { ScopedExportRequest, ExportOptions } from "../src/types.js";
import { OpenHandsExporter } from "../src/openhands/index.js";

describe("OpenHands exporter", () => {
  it("should export multiple files per rule", async () => {
    const exporter = new OpenHandsExporter();

    const mockRule1 = {
      filename: "typescript.md",
      hash: "hash1",
      content: "TypeScript guidelines",
      frontmatter: {
        title: "TypeScript",
        description: "Type safety rules",
      },
    };

    const mockRule2 = {
      filename: "security.md",
      hash: "hash2",
      content: "Security best practices",
      frontmatter: {
        title: "Security",
        description: "Keep it secure",
      },
    };

    const request: ScopedExportRequest = {
      scope: { path: ".", isDefault: true, normalizedPath: "." },
      align: {
        sections: [],
        rules: [mockRule1, mockRule2],
      } as any,
    };

    const options: ExportOptions = {
      outputDir: "/tmp/openhands-test",
      dryRun: true,
    };

    const result = await exporter.export(request, options);

    expect(result.success).toBe(true);
    // In dry-run mode, no files are returned, but hash should be computed
    expect(result.contentHash).toBeDefined();
  });

  it("should handle empty rules", async () => {
    const exporter = new OpenHandsExporter();

    const request: ScopedExportRequest = {
      scope: { path: ".", isDefault: true, normalizedPath: "." },
      align: {
        sections: [],
        rules: [],
      } as any,
    };

    const options: ExportOptions = {
      outputDir: "/tmp/openhands-test",
      dryRun: true,
    };

    const result = await exporter.export(request, options);

    expect(result.success).toBe(true);
    expect(result.filesWritten).toEqual([]);
    expect(result.contentHash).toBe("");
  });
});
