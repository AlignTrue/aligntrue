import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { AgentsExporter } from "../src/agents/index.js";
import { CursorExporter } from "../src/cursor/index.js";
import type { AlignSection } from "@aligntrue/schema";
import type { ScopedExportRequest } from "@aligntrue/plugin-contracts";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Source Markers", () => {
  const testRoot = join(__dirname, "../.test-output-source-markers");
  let agentsExporter: AgentsExporter;
  let cursorExporter: CursorExporter;

  beforeEach(() => {
    agentsExporter = new AgentsExporter();
    cursorExporter = new CursorExporter();
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
  });

  const createSection = (
    heading: string,
    sourceFile?: string,
  ): AlignSection => ({
    heading,
    level: 2,
    content: `Content for ${heading}`,
    fingerprint: "",
    vendor: sourceFile
      ? {
          aligntrue: {
            source_file: sourceFile,
          },
        }
      : undefined,
  });

  const createRequest = (sections: AlignSection[]): ScopedExportRequest => ({
    scope: {
      path: ".",
      normalizedPath: ".",
      isDefault: true,
    },
    pack: {
      id: "test-pack",
      version: "1.0.0",
      spec_version: "1",
      sections,
    },
    outputPath: join(testRoot, "AGENTS.md"),
  });

  it("should not show markers by default for single source", async () => {
    const sections = [
      createSection("Security", "security.md"),
      createSection("Testing", "security.md"),
    ];

    const config = {
      sync: {
        source_files: "security.md", // Single file
      },
    };

    const result = await agentsExporter.export(createRequest(sections), {
      outputDir: testRoot,
      config,
    });

    expect(result.success).toBe(true);
    const content = readFileSync(result.filesWritten[0], "utf-8");
    expect(content).not.toContain("<!-- aligntrue:source");
  });

  it("should show markers in auto mode with multiple sources", async () => {
    const sections = [
      createSection("Security", "security.md"),
      createSection("Testing", "testing.md"),
    ];

    const config = {
      sync: {
        source_files: ["security.md", "testing.md"], // Multiple files
      },
    };

    const result = await agentsExporter.export(createRequest(sections), {
      outputDir: testRoot,
      config,
    });

    expect(result.success).toBe(true);
    const content = readFileSync(result.filesWritten[0], "utf-8");
    expect(content).toContain("<!-- aligntrue:source security.md -->");
    expect(content).toContain("<!-- aligntrue:source testing.md -->");
  });

  it("should show markers in auto mode with glob pattern", async () => {
    const sections = [
      createSection("Security", "security.md"),
      createSection("Testing", "testing.md"),
    ];

    const config = {
      sync: {
        source_files: "rules/*.md", // Glob pattern indicates multiple
      },
    };

    const result = await agentsExporter.export(createRequest(sections), {
      outputDir: testRoot,
      config,
    });

    expect(result.success).toBe(true);
    const content = readFileSync(result.filesWritten[0], "utf-8");
    expect(content).toContain("<!-- aligntrue:source security.md -->");
    expect(content).toContain("<!-- aligntrue:source testing.md -->");
  });

  it("should always show markers when mode is always", async () => {
    const sections = [createSection("Security", "security.md")];

    const config = {
      sync: {
        source_files: "security.md", // Single file
        source_markers: "always",
      },
    };

    const result = await agentsExporter.export(createRequest(sections), {
      outputDir: testRoot,
      config,
    });

    expect(result.success).toBe(true);
    const content = readFileSync(result.filesWritten[0], "utf-8");
    expect(content).toContain("<!-- aligntrue:source security.md -->");
  });

  it("should never show markers when mode is never", async () => {
    const sections = [
      createSection("Security", "security.md"),
      createSection("Testing", "testing.md"),
    ];

    const config = {
      sync: {
        source_files: ["security.md", "testing.md"], // Multiple files
        source_markers: "never",
      },
    };

    const result = await agentsExporter.export(createRequest(sections), {
      outputDir: testRoot,
      config,
    });

    expect(result.success).toBe(true);
    const content = readFileSync(result.filesWritten[0], "utf-8");
    expect(content).not.toContain("<!-- aligntrue:source");
  });

  it("should include source filename in marker", async () => {
    const sections = [createSection("Security", "rules/security.md")];

    const config = {
      sync: {
        source_files: "rules/*.md",
      },
    };

    const result = await agentsExporter.export(createRequest(sections), {
      outputDir: testRoot,
      config,
    });

    expect(result.success).toBe(true);
    const content = readFileSync(result.filesWritten[0], "utf-8");
    expect(content).toContain("<!-- aligntrue:source rules/security.md -->");
  });

  it("should not show markers for sections without source_file", async () => {
    const sections = [
      createSection("Security", "security.md"),
      createSection("NoSource"), // No source_file
    ];

    const config = {
      sync: {
        source_files: ["security.md", "other.md"],
      },
    };

    const result = await agentsExporter.export(createRequest(sections), {
      outputDir: testRoot,
      config,
    });

    expect(result.success).toBe(true);
    const content = readFileSync(result.filesWritten[0], "utf-8");
    expect(content).toContain("<!-- aligntrue:source security.md -->");
    // Check that NoSource section exists but has no marker before it
    const lines = content.split("\n");
    const noSourceIndex = lines.findIndex((line) =>
      line.includes("## NoSource"),
    );
    expect(noSourceIndex).toBeGreaterThan(-1);
    // Previous line should not be a marker
    expect(lines[noSourceIndex - 1]).not.toContain("<!-- aligntrue:source");
  });

  it("should work with CursorExporter", async () => {
    const sections = [
      createSection("Security", "security.md"),
      createSection("Testing", "testing.md"),
    ];

    const config = {
      sync: {
        source_files: ["security.md", "testing.md"],
      },
    };

    const result = await cursorExporter.export(createRequest(sections), {
      outputDir: testRoot,
      config,
    });

    expect(result.success).toBe(true);
    const content = readFileSync(result.filesWritten[0], "utf-8");
    expect(content).toContain("<!-- aligntrue:source security.md -->");
    expect(content).toContain("<!-- aligntrue:source testing.md -->");
  });
});
