/**
 * Root MCP config exporter
 * Exports AlignTrue rules to root-level .mcp.json format
 * Used by: Claude Code, Aider
 */

import { join } from "path";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "../types.js";
import type { AlignRule } from "@aligntrue/schema";
import { canonicalizeJson, computeHash } from "@aligntrue/schema";
import { AtomicFileWriter } from "@aligntrue/file-utils";

interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>;
  seenScopes: Set<string>;
}

interface McpConfig {
  version: string;
  generated_by: string;
  content_hash: string;
  unresolved_plugs?: number;
  rules: McpRule[];
  fidelity_notes?: string[];
}

interface McpRule {
  id: string;
  severity: "error" | "warn" | "info";
  guidance: string;
  scope?: string;
  applies_to?: string[];
  [key: string]: any;
}

export class RootMcpExporter implements ExporterPlugin {
  name = "root-mcp";
  version = "1.0.0";

  private state: ExporterState = {
    allRules: [],
    seenScopes: new Set(),
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules } = request;
    const { outputDir, dryRun = false } = options;

    if (!rules || rules.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    const scopePath = this.formatScopePath(scope);
    rules.forEach((rule) => {
      this.state.allRules.push({ rule, scopePath });
    });
    this.state.seenScopes.add(scopePath);

    const outputPath = join(outputDir, ".mcp.json");

    const mcpConfig = this.generateMcpConfig(options.unresolvedPlugsCount);
    const content = JSON.stringify(mcpConfig, null, 2) + "\n";

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const irContent = JSON.stringify({ rules: allRulesIR });
    const contentHash = computeHash(canonicalizeJson(irContent));

    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    if (!dryRun) {
      const writer = new AtomicFileWriter();
      writer.write(outputPath, content);
    }

    const result: ExportResult = {
      success: true,
      filesWritten: dryRun ? [] : [outputPath],
      contentHash,
    };

    if (fidelityNotes.length > 0) {
      result.fidelityNotes = fidelityNotes;
    }

    return result;
  }

  resetState(): void {
    this.state = {
      allRules: [],
      seenScopes: new Set(),
    };
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  private generateMcpConfig(unresolvedPlugs?: number): McpConfig {
    const rules: McpRule[] = this.state.allRules.map(({ rule, scopePath }) => {
      const mcpRule: McpRule = {
        id: rule.id,
        severity: rule.severity,
        guidance: rule.guidance || "",
        scope: scopePath,
        applies_to: rule.applies_to || [],
      };

      return mcpRule;
    });

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const irContent = JSON.stringify({ rules: allRulesIR });
    const contentHash = computeHash(canonicalizeJson(irContent));
    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    const config: McpConfig = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      rules,
    };

    if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
      config.unresolved_plugs = unresolvedPlugs;
    }

    if (fidelityNotes.length > 0) {
      config.fidelity_notes = fidelityNotes;
    }

    return config;
  }

  private computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = [];
    const unmappedFields = new Set<string>();

    rules.forEach((rule) => {
      if (rule.check) {
        unmappedFields.add("check");
      }
      if (rule.autofix) {
        unmappedFields.add("autofix");
      }
    });

    if (unmappedFields.has("check")) {
      notes.push(
        "Machine-checkable rules (check) not represented in MCP config format",
      );
    }
    if (unmappedFields.has("autofix")) {
      notes.push("Autofix hints not represented in MCP config format");
    }

    return notes;
  }
}

export default RootMcpExporter;
