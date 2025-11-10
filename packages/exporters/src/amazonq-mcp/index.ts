/**
 * Amazon Q MCP config exporter
 * Exports AlignTrue rules to .amazonq/mcp.json format
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
}

interface McpConfig {
  version: string;
  generated_by: string;
  content_hash: string;
  unresolved_plugs?: number;
  rules: Array<{
    id: string;
    severity: "error" | "warn" | "info";
    guidance: string;
    scope?: string;
    applies_to?: string[];
  }>;
  fidelity_notes?: string[];
}

export class AmazonQMcpExporter extends ExporterBase {
  name = "amazonq-mcp";
  version = "1.0.0";

  private state: ExporterState = {
    allRules: [],
    allSections: [],
    useSections: false,
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules, pack } = request;
    const sections = getSections(pack);
    if (
      this.state.allRules.length === 0 &&
      this.state.allSections.length === 0
    ) {
      this.state.useSections = sections.length > 0;
    }
    if ((!rules || rules.length === 0) && sections.length === 0) {
      return { success: true, filesWritten: [], contentHash: "" };
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

    const outputPath = join(outputDir, ".amazonq", "mcp.json");

    const mcpConfig = this.generateMcpConfig(options.unresolvedPlugsCount);
    const content = JSON.stringify(mcpConfig, null, 2) + "\n";

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });

    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    if (!dryRun) {
      const amazonqDirPath = dirname(outputPath);
      mkdirSync(amazonqDirPath, { recursive: true });
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
    };
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  private generateMcpConfig(unresolvedPlugs?: number): McpConfig {
    const rules = this.state.allRules.map(({ rule, scopePath }) => ({
      id: rule.id,
      severity: rule.severity,
      guidance: rule.guidance || "",
      scope: scopePath,
      applies_to: rule.applies_to || [],
    }));

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

export default AmazonQMcpExporter;
