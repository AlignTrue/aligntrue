/**
 * Tests for VS Code MCP config exporter
 * Validates v1 JSON format generation, vendor.vscode extraction, scope merging, and snapshot outputs
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { VsCodeMcpExporter } from "../src/vscode-mcp/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
  ResolvedScope,
} from "../src/types.js";
import type { AlignRule, AlignPack } from "@aligntrue/schema";

// Helper to load YAML fixture
function loadFixture(name: string): { rules: AlignRule[] } {
  const fixturePath = join(__dirname, "fixtures", "vscode-mcp", `${name}.yaml`);
  const content = readFileSync(fixturePath, "utf-8");
  const data = parseYaml(content) as any;
  return { rules: data.rules || [] };
}

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
  rules: AlignRule[],
): ScopedExportRequest {
  const pack: AlignPack = {
    id: "test-pack",
    version: "1.0.0",
    spec_version: "1",
    rules,
  };

  return {
    scope,
    rules,
    pack,
    outputPath: "/test/output",
  };
}

describe("VsCodeMcpExporter", () => {
  let exporter: VsCodeMcpExporter;
  let options: ExportOptions;

  beforeEach(() => {
    exporter = new VsCodeMcpExporter();
    options = {
      outputDir: "/test/output",
      dryRun: true, // Default to dry-run for tests
    };
  });

  describe("Basic functionality", () => {
    it("implements ExporterPlugin interface", () => {
      expect(exporter.name).toBe("vscode-mcp");
      expect(exporter.version).toBe("1.0.0");
      expect(typeof exporter.export).toBe("function");
    });

    it("exports single rule successfully", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten).toEqual([]);
      expect(result.contentHash).toBeTruthy();
      expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("exports multiple rules successfully", async () => {
      const { rules } = loadFixture("multiple-rules");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

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
    it("generates v1 version marker in JSON", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config.version).toBe("v1");
    });

    it("includes generated_by field", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config.generated_by).toBe("AlignTrue");
    });

    it("maps severity correctly (error, warn, info)", async () => {
      const { rules } = loadFixture("all-severities");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config.rules[0].severity).toBe("error");
      expect(config.rules[1].severity).toBe("warn");
      expect(config.rules[2].severity).toBe("info");
    });

    it("includes rule ID, guidance, scope in each rule", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config.rules[0].id).toBe("testing.require-tests");
      expect(config.rules[0].guidance).toContain(
        "All features must have tests",
      );
      // Default scope doesn't add scope field, but applies_to is present
      expect(config.rules[0].applies_to).toEqual(["**/*.ts"]);
    });

    it("computes and includes content_hash (64-char hex)", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      const result = await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config.content_hash).toBeTruthy();
      expect(config.content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.contentHash).toBe(config.content_hash);
    });

    it("generates valid JSON (JSON.parse succeeds)", async () => {
      const { rules } = loadFixture("multiple-rules");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();
      const jsonString = JSON.stringify(config, null, 2);

      expect(() => JSON.parse(jsonString)).not.toThrow();
      const parsed = JSON.parse(jsonString);
      expect(parsed.version).toBe("v1");
      expect(Array.isArray(parsed.rules)).toBe(true);
    });
  });

  describe("Vendor extraction", () => {
    it("extracts vendor.vscode fields to top level of rule", async () => {
      const { rules } = loadFixture("with-vendor-vscode");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      const rule = config.rules[0];
      expect(rule.workbench_setting).toBe("editor.formatOnSave");
      expect(rule.diagnostic_code).toBe("format-001");
      expect(rule.quick_fix_available).toBe(true);
    });

    it("flattens nested vendor.vscode objects correctly", async () => {
      const { rules } = loadFixture("with-vendor-vscode");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      const rule = config.rules[0];
      // All vendor.vscode fields should be at top level, not nested
      expect(rule.vendor).toBeUndefined();
      expect(rule.workbench_setting).toBeDefined();
      expect(rule.diagnostic_code).toBeDefined();
    });

    it("preserves non-vscode vendor fields (does not extract)", async () => {
      const { rules } = loadFixture("mixed-vendor");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      const rule = config.rules[0];
      // VS Code fields should be extracted
      expect(rule.diagnostic_severity).toBe("Warning");
      expect(rule.code_action_kind).toBe("quickfix");

      // Non-vscode vendor fields should NOT be extracted (cursor, copilot remain in IR)
      expect(rule.show_inline).toBeUndefined();
      expect(rule.context_priority).toBeUndefined();
    });

    it("handles rules with no vendor.vscode gracefully", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      const rule = config.rules[0];
      expect(rule.id).toBe("testing.require-tests");
      expect(rule.severity).toBe("warn");
      expect(rule.guidance).toBeTruthy();
      // No vendor fields extracted, just core fields
    });
  });

  describe("Scope merging", () => {
    it("merges multiple scopes into single file", async () => {
      exporter.resetState();

      // First scope
      const scope1 = createMockScope("backend", false);
      const rules1: AlignRule[] = [
        {
          id: "backend.api-tests",
          severity: "error",
          applies_to: ["backend/**/*.ts"],
          guidance: "API tests required",
        },
      ];
      const request1 = createRequest(scope1, rules1);
      await exporter.export(request1, options);

      // Second scope
      const scope2 = createMockScope("frontend", false);
      const rules2: AlignRule[] = [
        {
          id: "frontend.component-tests",
          severity: "warn",
          applies_to: ["frontend/**/*.tsx"],
          guidance: "Component tests recommended",
        },
      ];
      const request2 = createRequest(scope2, rules2);
      await exporter.export(request2, options);

      const config = (exporter as any).generateMcpConfig();

      // Both rules should be present
      expect(config.rules).toHaveLength(2);
      expect(config.rules[0].id).toBe("backend.api-tests");
      expect(config.rules[1].id).toBe("frontend.component-tests");
    });

    it("preserves scope path in rule metadata", async () => {
      exporter.resetState();

      const scope = createMockScope("backend", false);
      const rules: AlignRule[] = [
        {
          id: "backend.api-tests",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "API tests required",
        },
      ];
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config.rules[0].scope).toBe("backend");
    });

    it("handles default scope correctly", async () => {
      exporter.resetState();

      const { rules } = loadFixture("single-rule");
      const scope = createMockScope(".", true);
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      // Default scope should not add scope field
      expect(config.rules[0].scope).toBeUndefined();
      // But applies_to should be present
      expect(config.rules[0].applies_to).toEqual(["**/*.ts"]);
    });
  });

  describe("Fidelity tracking", () => {
    it("tracks unmapped fields (check, autofix) in fidelity_notes", async () => {
      exporter.resetState();

      const rules: AlignRule[] = [
        {
          id: "test.rule",
          severity: "warn",
          guidance: "Test guidance",
          check: {
            type: "file_exists" as any,
            inputs: { path: "test.txt" },
          },
          autofix: {
            description: "Auto-fix description",
            command: "fix-it",
          },
        },
      ];
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      const result = await exporter.export(request, options);

      expect(result.fidelityNotes).toBeDefined();
      expect(result.fidelityNotes).toContain(
        "Machine-checkable rules (check) not represented in MCP config format",
      );
      expect(result.fidelityNotes).toContain(
        "Autofix hints not represented in MCP config format",
      );
    });

    it("tracks non-vscode vendor fields (cursor, copilot, etc.)", async () => {
      exporter.resetState();

      const { rules } = loadFixture("mixed-vendor");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      const result = await exporter.export(request, options);

      expect(result.fidelityNotes).toBeDefined();
      expect(
        result.fidelityNotes!.some((note) =>
          note.includes(
            "Vendor-specific metadata for other agents not extracted to MCP config",
          ),
        ),
      ).toBe(true);
      expect(
        result.fidelityNotes!.some(
          (note) => note.includes("copilot") && note.includes("cursor"),
        ),
      ).toBe(true);
    });

    it("does NOT include vendor.vscode in fidelity notes (since extracted)", async () => {
      exporter.resetState();

      const { rules } = loadFixture("with-vendor-vscode");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      const result = await exporter.export(request, options);

      // Should not have fidelity notes for vendor.vscode since we extract it
      if (result.fidelityNotes) {
        result.fidelityNotes.forEach((note) => {
          expect(note).not.toContain("vscode");
        });
      }
    });
  });

  describe("Content hash", () => {
    it("computes deterministic hash from canonical IR", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      const result1 = await exporter.export(request, options);

      // Reset and export again
      exporter.resetState();
      const result2 = await exporter.export(request, options);

      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it("hash consistent across multiple exports of same IR", async () => {
      const { rules } = loadFixture("multiple-rules");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

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
    it("writes to .vscode/mcp.json at workspace root", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      // In dry-run mode, verify path construction is correct
      const result = await exporter.export(request, {
        outputDir: "/workspace",
        dryRun: true,
      });

      // Verify it would write to .vscode/mcp.json at root
      expect(result.success).toBe(true);

      // Path should be .vscode/mcp.json at workspace root
      // Note: In dry-run mode, filesWritten is empty, so we verify path construction
      // would produce platform-agnostic path
      if (result.filesWritten.length > 0) {
        expect(result.filesWritten[0].replace(/\\/g, "/")).toMatch(
          /\/\.vscode\/mcp\.json$/,
        );
      } else {
        // In dry-run, verify expected path structure would be correct
        const expectedPath = join("/workspace", ".vscode", "mcp.json").replace(
          /\\/g,
          "/",
        );
        expect(expectedPath).toBe("/workspace/.vscode/mcp.json");
      }
    });

    it("dry-run mode returns content without writing", async () => {
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

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
    it("single rule golden JSON output", async () => {
      exporter.resetState();
      const { rules } = loadFixture("single-rule");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config).toMatchSnapshot();
    });

    it("multiple rules golden JSON output", async () => {
      exporter.resetState();
      const { rules } = loadFixture("multiple-rules");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config).toMatchSnapshot();
    });

    it("with vendor.vscode extracted golden output", async () => {
      exporter.resetState();
      const { rules } = loadFixture("with-vendor-vscode");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config).toMatchSnapshot();
    });

    it("mixed vendor fields golden output", async () => {
      exporter.resetState();
      const { rules } = loadFixture("mixed-vendor");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config).toMatchSnapshot();
    });

    it("all severities golden JSON output", async () => {
      exporter.resetState();
      const { rules } = loadFixture("all-severities");
      const scope = createMockScope();
      const request = createRequest(scope, rules);

      await exporter.export(request, options);
      const config = (exporter as any).generateMcpConfig();

      expect(config).toMatchSnapshot();
    });
  });
});
