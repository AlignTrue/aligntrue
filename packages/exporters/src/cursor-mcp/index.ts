/**
 * Cursor MCP config exporter
 * Exports AlignTrue rules to .cursor/mcp.json format
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "../types.js";
import type { AlignRule } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

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

export class CursorMcpExporter extends ExporterBase {
  name = "cursor-mcp";
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

    const outputPath = join(outputDir, ".cursor", "mcp.json");

    const mcpConfig = this.generateMcpConfig(options.unresolvedPlugsCount);
    const content = JSON.stringify(mcpConfig, null, 2) + "\n";

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });

    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    if (!dryRun) {
      const cursorDirPath = dirname(outputPath);
      mkdirSync(cursorDirPath, { recursive: true });
    }

    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
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

      if (rule.vendor && rule.vendor["cursor"]) {
        const cursorVendor = rule.vendor["cursor"] as Record<string, any>;
        Object.entries(cursorVendor).forEach(([key, value]) => {
          if (key !== "_meta") {
            mcpRule[key] = value;
          }
        });
      }

      return mcpRule;
    });

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });
    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    const config: McpConfig = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      rules,
    };

    if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
      config["unresolved_plugs"] = unresolvedPlugs;
    }

    if (fidelityNotes.length > 0) {
      config.fidelity_notes = fidelityNotes;
    }

    return config;
  }

  override computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = [];
    const unmappedFields = new Set<string>();
    const crossAgentVendors = new Set<string>();

    rules.forEach((rule) => {
      if (rule.check) {
        unmappedFields.add("check");
      }
      if (rule.autofix) {
        unmappedFields.add("autofix");
      }

      if (rule.vendor) {
        Object.keys(rule.vendor).forEach((agent) => {
          if (agent !== "cursor" && agent !== "_meta") {
            crossAgentVendors.add(agent);
          }
        });
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

    if (crossAgentVendors.size > 0) {
      const agents = Array.from(crossAgentVendors).sort().join(", ");
      notes.push(
        `Vendor-specific metadata for other agents not extracted to MCP config: ${agents}`,
      );
    }

    return notes;
  }
}

export default CursorMcpExporter;
