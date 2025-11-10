/**
 * Windsurf MCP config exporter
 * Exports AlignTrue rules to .windsurf/mcp_config.json format
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "../types.js";
import type { AlignRule, AlignSection } from "@aligntrue/schema";
import { computeContentHash, getSections } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>;
  allSections: Array<{ section: AlignSection; scopePath: string }>;
  useSections: boolean;
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
  [key: string]: unknown;
}

export class WindsurfMcpExporter extends ExporterBase {
  name = "windsurf-mcp";
  version = "1.0.0";

  private state: ExporterState = {
    allRules: [],
    allSections: [],
    useSections: false,
    seenScopes: new Set(),
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules, pack } = request;
    const sections = getSections(pack);
    const useSections = sections.length > 0;

    if (
      this.state.allRules.length === 0 &&
      this.state.allSections.length === 0
    ) {
      this.state.useSections = useSections;
    }
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

    const outputPath = join(outputDir, ".windsurf", "mcp_config.json");

    const mcpConfig = this.generateMcpConfig(options.unresolvedPlugsCount);
    const content = JSON.stringify(mcpConfig, null, 2) + "\n";

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });

    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    if (!dryRun) {
      const windsurfDirPath = dirname(outputPath);
      mkdirSync(windsurfDirPath, { recursive: true });
    }

    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    const result = this.buildResult(filesWritten, contentHash, fidelityNotes);

    return result;
  }

  resetState(): void {
    this.state = {
      allRules: [],
      allSections: [],
      useSections: false,
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

      if (rule.vendor && rule.vendor["windsurf"]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const windsurfVendor = rule.vendor["windsurf"] as Record<string, any>;
        Object.entries(windsurfVendor).forEach(([key, value]) => {
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
          if (agent !== "windsurf" && agent !== "_meta") {
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

export default WindsurfMcpExporter;
