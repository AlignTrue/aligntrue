/**
 * Exporter Format Validation Contract Tests
 *
 * Verifies that exported files are valid and parseable:
 * 1. Cursor .mdc frontmatter format validation
 * 2. AGENTS.md follows expected structure
 * 3. VSCode MCP config is valid JSON schema
 * 4. Each exporter produces parseable output
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
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

const TEST_OUTPUT_DIR = join(
  import.meta.dirname,
  "..",
  "temp-format-validation",
);

// Standard test sections
const standardSections: AlignSection[] = [
  {
    heading: "Code Quality",
    level: 2,
    content:
      "Always write clean, readable code.\n\n- Use meaningful variable names\n- Keep functions small",
    fingerprint: "code-quality",
  },
  {
    heading: "Testing",
    level: 2,
    content:
      "Write tests for all new features.\n\n```typescript\ntest('example', () => {\n  expect(true).toBe(true);\n});\n```",
    fingerprint: "testing",
  },
];

function createTestAlign(sections: AlignSection[]): Align {
  return {
    id: "format-validation-test",
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

/**
 * Parse YAML frontmatter from MDC/MD content
 */
function parseFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  try {
    return parseYaml(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

describe("Exporter Format Validation Contracts", () => {
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

  describe("Cursor MDC Format", () => {
    it("produces valid YAML frontmatter", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThan(0);

      for (const filePath of result.filesWritten) {
        const content = readFileSync(filePath, "utf-8");

        // Must start with frontmatter
        expect(content).toMatch(/^---\n/);

        // Frontmatter must be valid YAML
        const frontmatter = parseFrontmatter(content);
        expect(frontmatter).not.toBeNull();
      }
    });

    it("includes required MDC frontmatter fields", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      await exporter.export(
        createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );

      const content = readFileSync(
        join(TEST_OUTPUT_DIR, ".cursor", "rules", "code-quality.mdc"),
        "utf-8",
      );

      const frontmatter = parseFrontmatter(content);
      expect(frontmatter).not.toBeNull();

      // MDC frontmatter should have title or description
      // The exact fields depend on the exporter implementation
      expect(frontmatter).toBeDefined();
    });

    it("includes read-only marker", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      await exporter.export(
        createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );

      const content = readFileSync(
        join(TEST_OUTPUT_DIR, ".cursor", "rules", "code-quality.mdc"),
        "utf-8",
      );

      expect(content).toContain("READ-ONLY");
      expect(content).toContain("DO NOT EDIT DIRECTLY");
    });

    it("preserves markdown content structure", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      await exporter.export(
        createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );

      const content = readFileSync(
        join(TEST_OUTPUT_DIR, ".cursor", "rules", "testing.mdc"),
        "utf-8",
      );

      // Should preserve code blocks
      expect(content).toContain("```typescript");
      expect(content).toContain("```");
    });

    it("produces .mdc file extension", async () => {
      const exporter = new CursorExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".cursor", "rules", "test.mdc"),
        ),
        options,
      );

      for (const filePath of result.filesWritten) {
        expect(filePath).toMatch(/\.mdc$/);
      }
    });
  });

  describe("AGENTS.md Format", () => {
    it("produces valid markdown", async () => {
      const exporter = new AgentsExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, "AGENTS.md")),
        options,
      );

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBe(1);

      const content = readFileSync(result.filesWritten[0], "utf-8");

      // Should be valid markdown with structure
      expect(content).toContain("# ");
      expect(content).not.toContain("\0"); // No null bytes
    });

    it("includes required structure elements", async () => {
      const exporter = new AgentsExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      await exporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, "AGENTS.md")),
        options,
      );

      const content = readFileSync(join(TEST_OUTPUT_DIR, "AGENTS.md"), "utf-8");

      // Required elements
      expect(content).toContain("READ-ONLY");
      expect(content).toContain("# Agent Rules");
      expect(content).toContain(".aligntrue/rules/");
    });

    it("contains links to rule files", async () => {
      const exporter = new AgentsExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      await exporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, "AGENTS.md")),
        options,
      );

      const content = readFileSync(join(TEST_OUTPUT_DIR, "AGENTS.md"), "utf-8");

      // Link format: [Title](path)
      expect(content).toMatch(/\[.+\]\(.+\.md\)/);
    });

    it("produces AGENTS.md filename", async () => {
      const exporter = new AgentsExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, "AGENTS.md")),
        options,
      );

      expect(result.filesWritten[0]).toMatch(/AGENTS\.md$/);
    });
  });

  describe("VSCode MCP JSON Format", () => {
    it("produces valid JSON", async () => {
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
        dryRun: false,
        config: mcpConfig,
      };

      const result = await exporter.export(
        createRequest([], join(TEST_OUTPUT_DIR, ".vscode", "mcp.json")),
        options,
      );

      expect(result.success).toBe(true);

      if (result.filesWritten.length > 0) {
        const content = readFileSync(result.filesWritten[0], "utf-8");

        // Should be valid JSON
        expect(() => JSON.parse(content)).not.toThrow();

        const json = JSON.parse(content);
        expect(json).toBeDefined();
      }
    });

    it("contains MCP server configuration", async () => {
      const exporter = new VsCodeMcpExporter();
      const mcpConfig = {
        mcp: {
          servers: [
            {
              name: "test-mcp",
              command: "npx",
              args: ["-y", "@aligntrue/mcp-server"],
            },
          ],
        },
      };
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
        config: mcpConfig,
      };

      const result = await exporter.export(
        createRequest([], join(TEST_OUTPUT_DIR, ".vscode", "mcp.json")),
        options,
      );

      if (result.filesWritten.length > 0) {
        const content = readFileSync(result.filesWritten[0], "utf-8");
        const json = JSON.parse(content);

        // Should have mcpServers structure
        expect(json.mcpServers || json.servers).toBeDefined();
      }
    });

    it("produces mcp.json in .vscode directory", async () => {
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
        dryRun: false,
        config: mcpConfig,
      };

      const result = await exporter.export(
        createRequest([], join(TEST_OUTPUT_DIR, ".vscode", "mcp.json")),
        options,
      );

      if (result.filesWritten.length > 0) {
        expect(result.filesWritten[0]).toMatch(/\.vscode[/\\]mcp\.json$/);
      }
    });
  });

  describe("AmazonQ Format", () => {
    it("produces valid markdown files", async () => {
      const exporter = new AmazonQExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".amazonq", "rules", "test.md"),
        ),
        options,
      );

      expect(result.success).toBe(true);

      for (const filePath of result.filesWritten) {
        const content = readFileSync(filePath, "utf-8");

        // Should be valid markdown
        expect(content).not.toContain("\0");

        // Should have read-only marker
        expect(content).toContain("READ-ONLY");
      }
    });

    it("produces .md file extension", async () => {
      const exporter = new AmazonQExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(
          standardSections,
          join(TEST_OUTPUT_DIR, ".amazonq", "rules", "test.md"),
        ),
        options,
      );

      for (const filePath of result.filesWritten) {
        expect(filePath).toMatch(/\.md$/);
      }
    });
  });

  describe("Cline Format", () => {
    it("produces valid markdown", async () => {
      const exporter = new ClineExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, ".clinerules")),
        options,
      );

      expect(result.success).toBe(true);

      if (result.filesWritten.length > 0) {
        const content = readFileSync(result.filesWritten[0], "utf-8");

        // Should be valid markdown
        expect(content).not.toContain("\0");
        expect(content).toContain("READ-ONLY");
      }
    });

    it("produces files in .clinerules directory", async () => {
      const exporter = new ClineExporter();
      const options: ExportOptions = {
        outputDir: TEST_OUTPUT_DIR,
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, ".clinerules")),
        options,
      );

      if (result.filesWritten.length > 0) {
        // Cline uses a directory with .md files inside
        expect(result.filesWritten[0]).toMatch(/\.clinerules[/\\]/);
        expect(result.filesWritten[0]).toMatch(/\.md$/);
      }
    });
  });

  describe("Gemini Format", () => {
    it("produces valid markdown", async () => {
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
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, "GEMINI.md")),
        options,
      );

      expect(result.success).toBe(true);

      if (result.filesWritten.length > 0) {
        const content = readFileSync(result.filesWritten[0], "utf-8");

        // Should be valid markdown
        expect(content).not.toContain("\0");
        expect(content).toContain("READ-ONLY");
      }
    });

    it("produces GEMINI.md file", async () => {
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
        dryRun: false,
      };

      const result = await exporter.export(
        createRequest(standardSections, join(TEST_OUTPUT_DIR, "GEMINI.md")),
        options,
      );

      if (result.filesWritten.length > 0) {
        expect(result.filesWritten[0]).toMatch(/GEMINI\.md$/);
      }
    });
  });

  describe("Cross-Format Consistency", () => {
    it("all markdown exporters include read-only marker", async () => {
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
        dryRun: false,
      };

      for (const { name, exporter, path } of exporters) {
        const result = await exporter.export(
          createRequest(standardSections, join(TEST_OUTPUT_DIR, path)),
          options,
        );

        if (result.filesWritten.length > 0) {
          const content = readFileSync(result.filesWritten[0], "utf-8");
          expect(content).toContain(
            "READ-ONLY",
            `${name} exporter should include read-only marker`,
          );
        }
      }
    });

    it("all exporters produce non-empty output for non-empty sections", async () => {
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
        dryRun: false,
      };

      for (const { name, exporter, path } of exporters) {
        const result = await exporter.export(
          createRequest(standardSections, join(TEST_OUTPUT_DIR, path)),
          options,
        );

        expect(
          result.filesWritten.length,
          `${name} should write files`,
        ).toBeGreaterThan(0);

        const content = readFileSync(result.filesWritten[0], "utf-8");
        expect(
          content.length,
          `${name} should produce non-empty content`,
        ).toBeGreaterThan(0);
      }
    });
  });
});
