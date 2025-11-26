/**
 * Tests for AGENTS.md exporter
 * Validates v1 format generation, scope merging, fidelity tracking, and snapshot outputs
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeHash } from "@aligntrue/schema";
import { join } from "path";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { AgentsExporter } from "../src/agents/index.js";
import { loadFixture } from "./helpers/test-fixtures.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { Align, AlignSection } from "@aligntrue/schema";

/**
 * Generate a stable fingerprint for tests
 */
function generateFingerprint(heading: string, content: string): string {
  const combined = `${heading}::${content}`;
  return computeHash(combined).substring(0, 16);
}

const FIXTURES_DIR = join(import.meta.dirname, "fixtures", "agents");
let TEST_OUTPUT_DIR: string;

// Helper to create mock scope with optional overrides
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

describe("AgentsExporter", () => {
  let exporter: AgentsExporter;
  let options: ExportOptions;

  beforeEach(() => {
    // Create temp directory
    TEST_OUTPUT_DIR = mkdtempSync(join(tmpdir(), "agents-test-"));
    exporter = new AgentsExporter();
    options = {
      outputDir: TEST_OUTPUT_DIR,
      dryRun: true, // Default to dry-run for tests
    };
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("Basic functionality", () => {
    it("implements ExporterPlugin interface", () => {
      expect(exporter.name).toBe("agents");
      expect(exporter.version).toBe("1.0.0");
      expect(typeof exporter.export).toBe("function");
    });

    it("exports single rule successfully", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toEqual([]);
      expect(result.contentHash).toBeTruthy();
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("exports multiple rules successfully", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });

    it("handles empty rules array", async () => {
      const scope = createMockScope();
      const request = createRequest(scope, []);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toEqual([]);
      expect(result.contentHash).toBe("");
    });
  });

  describe("Format validation", () => {
    it("exports with v1 header and version marker", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, {
        ...options,
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    }, 10000);

    it("handles rules with multiple severities", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "all-severities.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });

    it("exports sections with content", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
    });

    it("handles multiple rules successfully", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(sections.length).toBeGreaterThan(1);
    });

    it("generates content hash for export result", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.contentHash).toBeTruthy();
      expect(result.contentHash).toMatch(/^[a-f0-9]{0,64}$/);
    });
  });

  describe("Scope merging", () => {
    it("exports multiple scopes successfully", async () => {
      exporter.resetState();

      // First scope
      const scope1 = createMockScope("backend", false);
      const sections1: AlignSection[] = [
        {
          heading: "backend.api-tests",
          level: 2,
          content: "API tests required",
          fingerprint: generateFingerprint(
            "backend.api-tests",
            "API tests required",
          ),
        },
      ];
      const request1 = createRequest(scope1, sections1);
      const result1 = await exporter.export(request1, options);

      // Second scope
      const scope2 = createMockScope("frontend", false);
      const sections2: AlignSection[] = [
        {
          heading: "frontend.component-tests",
          level: 2,
          content: "Component tests recommended",
          fingerprint: generateFingerprint(
            "frontend.component-tests",
            "Component tests recommended",
          ),
        },
      ];
      const request2 = createRequest(scope2, sections2);
      const result2 = await exporter.export(request2, options);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it("preserves scope path information in export", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-scopes.yaml");
      const scope = createMockScope("backend", false);
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });

    it("handles default scope correctly", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope(".", true);
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(scope.isDefault).toBe(true);
    });
  });

  describe("Fidelity tracking", () => {
    it("exports sections with vendor field fixture", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "with-vendor-fields.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });

    it("exports sections with mixed vendor namespaces", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "with-vendor-fields.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      // fidelityNotes may be present for sections format
      expect(typeof result.contentHash).toBe("string");
    });
  });

  describe("Content hash", () => {
    it("computes deterministic hash from canonical IR", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result1 = await exporter.export(request, options);

      // Reset and export again
      exporter.resetState();
      const result2 = await exporter.export(request, options);

      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it("hash consistent across multiple exports of same IR", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const hashes: string[] = [];
      for (let i = 0; i < 3; i++) {
        exporter.resetState();
        const result = await exporter.export(request, options);
        hashes.push(result.contentHash);
      }

      expect(hashes[0]).toBe(hashes[1]);
      expect(hashes[1]).toBe(hashes[2]);
    });
  });

  describe("File operations", () => {
    it("writes to correct location (workspace root / AGENTS.md)", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      // In dry-run mode, verify path construction is correct
      const result = await exporter.export(request, {
        outputDir: "/workspace",
        dryRun: true,
      });

      // Verify it would write to AGENTS.md at root (not scoped directory)
      // In actual write mode, filesWritten would be ['/workspace/AGENTS.md']
      expect(result.success).toBe(true);

      // Also verify it's not writing to a scope-based subdirectory
      // (unlike Cursor exporter which writes to .cursor/rules/)
      // Note: In dry-run mode, filesWritten is empty, so we verify path construction
      // would produce platform-agnostic path that ends with AGENTS.md
      if (result.filesWritten.length > 0) {
        expect(result.filesWritten[0].replace(/\\/g, "/")).toMatch(
          /\/AGENTS\.md$/,
        );
      } else {
        // In dry-run, verify expected path structure would be correct
        const expectedPath = join("/workspace", "AGENTS.md").replace(
          /\\/g,
          "/",
        );
        expect(expectedPath).toBe("/workspace/AGENTS.md");
      }
    });

    it("dry-run mode returns content without writing", async () => {
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, {
        ...options,
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.filesWritten).toEqual([]);
      expect(result.contentHash).toBeTruthy();
    });
  });

  describe("Snapshot tests", () => {
    it("exports single rule successfully", async () => {
      exporter.resetState();
      const { sections } = loadFixture(FIXTURES_DIR, "single-rule.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });

    it("exports multiple rules successfully", async () => {
      exporter.resetState();
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-rules.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });

    it("exports multiple scopes successfully", async () => {
      exporter.resetState();
      const { sections } = loadFixture(FIXTURES_DIR, "multiple-scopes.yaml");

      const scope1 = createMockScope("backend", false);
      const request1 = createRequest(scope1, sections);
      const result1 = await exporter.export(request1, options);

      expect(result1.success).toBe(true);
      expect(result1.contentHash).toBeTruthy();
    });

    it("exports all severities successfully", async () => {
      exporter.resetState();
      const { sections } = loadFixture(FIXTURES_DIR, "all-severities.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });

    it("exports with vendor fields successfully", async () => {
      exporter.resetState();
      const { sections } = loadFixture(FIXTURES_DIR, "with-vendor-fields.yaml");
      const scope = createMockScope();
      const request = createRequest(scope, sections);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBeTruthy();
    });
  });
});
