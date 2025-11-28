/**
 * Exporter Hash Stability Contract Tests
 *
 * Verifies that all exporters produce stable, deterministic content hashes.
 * These tests ensure:
 * 1. Same input → same content hash across multiple exports
 * 2. All exporters follow the same hashing contract
 * 3. Export order doesn't affect final hash
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { AlignSection, Align } from "@aligntrue/schema";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import { CursorExporter } from "../../src/cursor/index.js";
import { AgentsExporter } from "../../src/agents/index.js";
import { VsCodeMcpExporter } from "../../src/vscode-mcp/index.js";
import { AmazonQExporter } from "../../src/amazonq/index.js";
import { ClineExporter } from "../../src/cline/index.js";
import { ExporterRegistry } from "../../src/registry.js";

const TEST_OUTPUT_DIR = join(import.meta.dirname, "..", "temp-hash-stability");

// Standard test sections used across all hash stability tests
const standardSections: AlignSection[] = [
  {
    heading: "Code Quality",
    level: 2,
    content:
      "Always write clean, readable code. Use meaningful variable names.",
    fingerprint: "code-quality",
  },
  {
    heading: "Testing",
    level: 2,
    content: "Write tests for all new features. Aim for 80% coverage.",
    fingerprint: "testing",
  },
  {
    heading: "Documentation",
    level: 2,
    content: "Document all public APIs. Keep README up to date.",
    fingerprint: "documentation",
  },
];

function createTestAlign(sections: AlignSection[]): Align {
  return {
    id: "hash-stability-test",
    version: "1.0.0",
    spec_version: "1",
    sections,
  };
}

function createDefaultScope(): ResolvedScope {
  return {
    path: ".",
    normalizedPath: ".",
    isDefault: true,
    include: ["**/*"],
  };
}

function createRequest(
  sections: AlignSection[],
  outputPath: string,
): ScopedExportRequest {
  return {
    scope: createDefaultScope(),
    align: createTestAlign(sections),
    outputPath,
  };
}

describe("Exporter Hash Stability Contracts", () => {
  beforeEach(() => {
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("CursorExporter Hash Stability", () => {
    it("produces identical hash for identical sections across multiple exports", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const request = createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        );
        const result = await exporter.export(request, options);
        hashes.push(result.contentHash);
      }

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hash for different content", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const sectionsA: AlignSection[] = [
        {
          heading: "Rule A",
          level: 2,
          content: "Content A",
          fingerprint: "rule-a",
        },
      ];

      const sectionsB: AlignSection[] = [
        {
          heading: "Rule A",
          level: 2,
          content: "Content B",
          fingerprint: "rule-a",
        },
      ];

      const resultA = await exporter.export(
        createRequest(
          sectionsA,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );
      const resultB = await exporter.export(
        createRequest(
          sectionsB,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );

      expect(resultA.contentHash).not.toBe(resultB.contentHash);
    });

    it("hash is order-independent for multiple sections", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const sectionsOrderA: AlignSection[] = [
        { heading: "Alpha", level: 2, content: "A", fingerprint: "alpha" },
        { heading: "Beta", level: 2, content: "B", fingerprint: "beta" },
        { heading: "Gamma", level: 2, content: "G", fingerprint: "gamma" },
      ];

      const sectionsOrderB: AlignSection[] = [
        { heading: "Gamma", level: 2, content: "G", fingerprint: "gamma" },
        { heading: "Alpha", level: 2, content: "A", fingerprint: "alpha" },
        { heading: "Beta", level: 2, content: "B", fingerprint: "beta" },
      ];

      const resultA = await exporter.export(
        createRequest(
          sectionsOrderA,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );
      const resultB = await exporter.export(
        createRequest(
          sectionsOrderB,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );

      // Hash should be same regardless of input order
      expect(resultA.contentHash).toBe(resultB.contentHash);
    });
  });

  describe("AgentsExporter Hash Stability", () => {
    it("produces identical hash for identical sections across multiple exports", async () => {
      const exporter = new AgentsExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const request = createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, "AGENTS.md"),
        );
        const result = await exporter.export(request, options);
        hashes.push(result.contentHash);
      }

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hash for different rule headings", async () => {
      // AgentsExporter generates links to rule files, so hash depends on file paths/headings
      const exporter = new AgentsExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const sectionsA: AlignSection[] = [
        {
          heading: "Rule A",
          level: 2,
          content: "Content",
          fingerprint: "rule-a",
        },
      ];

      const sectionsB: AlignSection[] = [
        {
          heading: "Rule B",
          level: 2,
          content: "Content",
          fingerprint: "rule-b",
        },
      ];

      const resultA = await exporter.export(
        createRequest(sectionsA, join(TEST_OUTPUT_DIR, "AGENTS.md")),
        options,
      );
      const resultB = await exporter.export(
        createRequest(sectionsB, join(TEST_OUTPUT_DIR, "AGENTS.md")),
        options,
      );

      expect(resultA.contentHash).not.toBe(resultB.contentHash);
    });
  });

  describe("VsCodeMcpExporter Hash Stability", () => {
    // VsCodeMcpExporter exports MCP server config, not sections
    // It requires mcp.servers in the config object
    it("produces identical hash for identical MCP config across multiple exports", async () => {
      const exporter = new VsCodeMcpExporter();
      const mcpConfig = {
        mcp: {
          servers: [
            { name: "test-server", command: "node", args: ["server.js"] },
          ],
        },
      };
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
        config: mcpConfig,
      };

      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const request = createRequest(
          [],
          join(TEST_OUTPUT_DIR, ".vscode", "mcp.json"),
        );
        const result = await exporter.export(request, options);
        hashes.push(result.contentHash);
      }

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns empty result when no MCP servers configured", async () => {
      const exporter = new VsCodeMcpExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const request = createRequest(
        [],
        join(TEST_OUTPUT_DIR, ".vscode", "mcp.json"),
      );
      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.contentHash).toBe("");
      expect(result.filesWritten).toEqual([]);
    });
  });

  describe("AmazonQExporter Hash Stability", () => {
    it("produces identical hash for identical sections across multiple exports", async () => {
      const exporter = new AmazonQExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const request = createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".amazonq", "rules", "test.md"),
        );
        const result = await exporter.export(request, options);
        hashes.push(result.contentHash);
      }

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("GeminiExporter Hash Stability", () => {
    it("produces identical hash for identical sections across multiple exports", async () => {
      // GeminiExporter needs to be loaded via registry from manifest
      const registry = new ExporterRegistry();
      const manifestPath = join(
        import.meta.dirname,
        "..",
        "..",
        "src",
        "gemini",
        "manifest.json",
      );
      await registry.registerFromManifest(manifestPath);
      const exporter = registry.get("gemini")!;

      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const request = createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, "GEMINI.md"),
        );
        const result = await exporter.export(request, options);
        hashes.push(result.contentHash);
      }

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("ClineExporter Hash Stability", () => {
    it("produces identical hash for identical sections across multiple exports", async () => {
      const exporter = new ClineExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const hashes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const request = createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".clinerules"),
        );
        const result = await exporter.export(request, options);
        hashes.push(result.contentHash);
      }

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
      expect(hashes[0]).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("Cross-Exporter Hash Consistency", () => {
    it("different exporters produce different hashes (output format differs)", async () => {
      const cursorExporter = new CursorExporter();
      const agentsExporter = new AgentsExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const cursorResult = await cursorExporter.export(
        createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );

      const agentsResult = await agentsExporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, "AGENTS.md")),
        options,
      );

      // Hashes should differ because output formats differ
      expect(cursorResult.contentHash).not.toBe(agentsResult.contentHash);
    });

    it("section-based exporters return valid SHA-256 hashes", async () => {
      // Note: VsCodeMcpExporter is excluded because it exports MCP config, not sections
      // Note: GeminiExporter tested separately via registry
      const exporters = [
        {
          name: "cursor",
          exporter: new CursorExporter(),
          path: ".cursor/rules/test.mdc",
        },
        { name: "agents", exporter: new AgentsExporter(), path: "AGENTS.md" },
        {
          name: "amazonq",
          exporter: new AmazonQExporter(),
          path: ".amazonq/rules/test.md",
        },
        { name: "cline", exporter: new ClineExporter(), path: ".clinerules" },
      ];

      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      for (const { name, exporter, path } of exporters) {
        const result = await exporter.export(
          createRequest(standardSections, join(TEST_OUTPUT_DIR, path)),
          options,
        );

        expect(result.contentHash).toMatch(
          /^[a-f0-9]{64}$/,
          `${name} exporter should produce valid SHA-256 hash`,
        );
      }
    });
  });

  describe("Empty Sections Handling", () => {
    it("section-based exporters handle empty sections consistently", async () => {
      // Note: VsCodeMcpExporter is excluded because it exports MCP config, not sections
      const exporters = [
        {
          name: "cursor",
          exporter: new CursorExporter(),
          path: ".cursor/rules/test.mdc",
        },
        { name: "agents", exporter: new AgentsExporter(), path: "AGENTS.md" },
        { name: "cline", exporter: new ClineExporter(), path: ".clinerules" },
      ];

      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      for (const { name, exporter, path } of exporters) {
        const result = await exporter.export(
          createRequest([], join(TEST_OUTPUT_DIR, path)),
          options,
        );

        expect(result.success).toBe(
          true,
          `${name} should succeed with empty sections`,
        );
        expect(result.filesWritten).toEqual([]);
        // Empty content should have empty or valid hash
        expect(result.contentHash).toBeDefined();
      }
    });
  });

  describe("Stability Under Load", () => {
    it("100 consecutive exports produce identical hashes", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: true,
      };

      const hashes: string[] = [];
      for (let i = 0; i < 100; i++) {
        const request = createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        );
        const result = await exporter.export(request, options);
        hashes.push(result.contentHash);
      }

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
    });
  });
});
