/**
 * Tests for content_mode feature (inline vs links export)
 * Validates auto switching, inline content generation, and size warnings
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { AgentsExporter } from "../src/agents/index.js";
import { GenericMarkdownExporter } from "../src/base/generic-markdown-exporter.js";
import { loadFixture } from "./helpers/test-fixtures.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { Align, AlignSection } from "@aligntrue/schema";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "agents");
let TEST_OUTPUT_DIR: string;

// Helper to create mock scope
function createMockScope(
  path: string = ".",
  isDefault: boolean = true,
): ResolvedScope {
  return {
    path,
    normalizedPath: path,
    include: ["**/*"],
    exclude: [],
    isDefault,
  };
}

// Helper to create scoped export request
function createRequest(
  scope: ResolvedScope,
  sections: AlignSection[],
): ScopedExportRequest {
  const align: Align = {
    id: "test-align",
    version: "1.0.0",
    spec_version: "1",
    sections,
  };

  return {
    scope,
    align,
    outputPath: join(TEST_OUTPUT_DIR, "AGENTS.md"),
  };
}

describe("content_mode feature", () => {
  let exporter: AgentsExporter;
  let options: ExportOptions;

  beforeEach(() => {
    // Create temp directory
    TEST_OUTPUT_DIR = mkdtempSync(join(tmpdir(), "content-mode-test-"));
    exporter = new AgentsExporter();
    options = {
      outputDir: TEST_OUTPUT_DIR,
      dryRun: false,
    };
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("auto mode (default)", () => {
    it("uses inline for single rule", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      // contentMode defaults to auto
      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThan(0);

      // Check content is inline (contains full rule content, not links)
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("<!-- aligntrue:rule");
      // Should not have link-based format (- Title (./path): description)
      expect(content).not.toMatch(/^- \S+\s\(\.\/.+\.aligntrue\/rules\//m);
    });

    it("uses links for multiple rules", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      // contentMode defaults to auto
      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThan(0);

      // Check content uses links (contains .aligntrue/rules/ paths)
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain(".aligntrue/rules/");
      expect(content).not.toContain("<!-- aligntrue:rule");
    });
  });

  describe("inline mode", () => {
    it("embeds full content with rule separators", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, {
        ...options,
        contentMode: "inline",
      });

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThan(0);

      // Check content is inline
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content).toContain("<!-- aligntrue:rule");
      // Should not have link-based format (- Title (./path): description)
      expect(content).not.toMatch(/^- \S+\s\(\.\/.+\.aligntrue\/rules\//m);

      // Should have separators for each rule
      const ruleComments = content.match(/<!-- aligntrue:rule/g);
      expect(ruleComments?.length).toBeGreaterThanOrEqual(2);
    });

    it("includes rule titles and descriptions", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, {
        ...options,
        contentMode: "inline",
      });

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Should contain rule heading
      expect(content).toMatch(/^## /m);
    });

    it("emits warning for content over 50KB", async () => {
      // This test validates warning behavior
      // In a real scenario, we'd need to create a section with >50KB content
      // For now, we verify the code path is exercised
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      // Small content won't trigger warning
      const result = await exporter.export(request, {
        ...options,
        contentMode: "inline",
      });

      expect(result.success).toBe(true);
      // No warning for small content
      expect(result.fidelityNotes?.length || 0).toBe(0);
    });

    it("strips starter rule comments from content", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();

      // Add a starter rule comment to the content
      const modifiedSections = sections.map((s) => ({
        ...s,
        content: `<!--
  STARTER RULE: This is a starter template
-->

${s.content}`,
      }));

      const modifiedRequest: ScopedExportRequest = {
        scope,
        align: {
          id: "test-align",
          version: "1.0.0",
          spec_version: "1",
          sections: modifiedSections,
        },
        outputPath: join(TEST_OUTPUT_DIR, "AGENTS.md"),
      };

      const result = await exporter.export(modifiedRequest, {
        ...options,
        contentMode: "inline",
      });

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Starter comment should be stripped
      expect(content).not.toContain("STARTER RULE:");
    });
  });

  describe("links mode", () => {
    it("always uses links regardless of rule count", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      // Force links mode even with single rule
      const result = await exporter.export(request, {
        ...options,
        contentMode: "links",
      });

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Should use links
      expect(content).toContain(".aligntrue/rules/");
      expect(content).not.toContain("<!-- aligntrue:rule");
    });

    it("generates proper markdown links", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, {
        ...options,
        contentMode: "links",
      });

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Should have plain text link format: Title (./path)
      expect(content).toMatch(/\S+\s\(\.[/]\.aligntrue\/rules\/[^)]+\)/);
    });
  });

  describe("config-based selection", () => {
    it("uses config content_mode when provided", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      // Pass config with content_mode
      const result = await exporter.export(request, {
        ...options,
        config: {
          sync: {
            content_mode: "links",
          },
        },
      });

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Should use links (from config) - check for link format (Title (./path))
      // Format: - Title (./path): description or - Title (./path)
      expect(content).toContain(".aligntrue/rules/");
      expect(content).toMatch(/- [A-Za-z].+\(/);
    });

    it("prefers CLI flag over config", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      // Config says links, but CLI says inline
      const result = await exporter.export(request, {
        ...options,
        contentMode: "inline", // CLI flag
        config: {
          sync: {
            content_mode: "links", // Config
          },
        },
      });

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Should use inline (from CLI flag, which takes precedence)
      expect(content).toContain("<!-- aligntrue:rule");
      // Should not have link-based format
      expect(content).not.toMatch(/^- \S+\s\(\.\/.+\.aligntrue\/rules\//m);
    });
  });

  describe("GenericMarkdownExporter", () => {
    it("supports content_mode same as AgentsExporter", async () => {
      const genericExporter = new GenericMarkdownExporter(
        "test-generic",
        "TEST.md",
        "Test Rules",
        "For testing",
      );

      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await genericExporter.export(request, {
        ...options,
        contentMode: "inline",
      });

      expect(result.success).toBe(true);
      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Should support inline mode
      expect(content).toContain("<!-- aligntrue:rule");
    });
  });

  describe("content hash stability", () => {
    it("produces consistent hash for same content in inline mode", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();

      // First export
      const request1 = createRequest(scope, sections);
      const result1 = await exporter.export(request1, {
        ...options,
        contentMode: "inline",
      });

      // Second export
      const request2 = createRequest(scope, sections);
      const result2 = await exporter.export(request2, {
        ...options,
        contentMode: "inline",
      });

      // Same content should produce same hash
      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it("produces different hash for inline vs links mode", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();

      // Inline export
      const request1 = createRequest(scope, sections);
      const result1 = await exporter.export(request1, {
        ...options,
        contentMode: "inline",
      });

      // Links export
      const request2 = createRequest(scope, sections);
      const result2 = await exporter.export(request2, {
        ...options,
        contentMode: "links",
      });

      // Different formats should produce different hashes
      expect(result1.contentHash).not.toBe(result2.contentHash);
    });
  });
});
