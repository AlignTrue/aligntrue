import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { CursorExporter } from "../../src/cursor/index.js";
import { createDefaultScope, createRequest } from "../helpers/test-fixtures.js";

describe("CursorExporter nested_location normalization", () => {
  let exporter: CursorExporter;
  let outputDir: string;

  beforeEach(() => {
    exporter = new CursorExporter();
    outputDir = mkdtempSync(join(tmpdir(), "cursor-nested-"));
  });

  afterEach(() => {
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true });
    }
  });

  it("normalizes Windows-style backslash paths in nested_location", async () => {
    const sections = [
      {
        heading: "Nested rule",
        level: 2,
        content: "Content",
        source_file: ".aligntrue/rules/nested.md",
        vendor: {
          aligntrue: {
            frontmatter: {
              nested_location: "apps\\docs",
            },
          },
        },
      },
    ];

    const request = createRequest(sections, createDefaultScope());
    const result = await exporter.export(request, {
      outputDir,
      dryRun: false,
    });

    expect(result.success).toBe(true);
    expect(result.filesWritten).toHaveLength(1);

    const normalizedPath = result.filesWritten[0].replace(/\\/g, "/");
    expect(normalizedPath).toContain("apps/docs/.cursor/rules/nested.mdc");
    expect(existsSync(result.filesWritten[0])).toBe(true);
  });
});
