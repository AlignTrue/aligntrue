/**
 * RooCode MCP config exporter
 * Exports AlignTrue rules to .roo/mcp.json format
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import type { AlignRule } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { ExporterBase } from "../base/index.js";

interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>;
}

export class RooCodeMcpExporter extends ExporterBase {
  name = "roocode-mcp";
  version = "1.0.0";

  private state: ExporterState = {
    allRules: [],
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules } = request;
    const { outputDir, dryRun = false } = options;

    if (!rules || rules.length === 0) {
      return { success: true, filesWritten: [], contentHash: "" };
    }

    const scopePath =
      scope.isDefault || scope.path === "." || scope.path === ""
        ? "all files"
        : scope.path;
    rules.forEach((rule) => this.state.allRules.push({ rule, scopePath }));

    const outputPath = join(outputDir, ".roo", "mcp.json");
    const mcpConfig: Record<string, any> = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: computeContentHash({
        rules: this.state.allRules.map(({ rule }) => rule),
      }),
      rules: this.state.allRules.map(({ rule, scopePath: sp }) => ({
        id: rule.id,
        severity: rule.severity,
        guidance: rule.guidance || "",
        scope: sp,
        applies_to: rule.applies_to || [],
      })),
    };

    if (
      options.unresolvedPlugsCount !== undefined &&
      options.unresolvedPlugsCount > 0
    ) {
      mcpConfig["unresolved_plugs"] = options.unresolvedPlugsCount;
    }

    const content = JSON.stringify(mcpConfig, null, 2) + "\n";
    const contentHash = mcpConfig["content_hash"];

    if (!dryRun) {
      mkdirSync(dirname(outputPath), { recursive: true });
      new AtomicFileWriter().write(outputPath, content);
    }

    return {
      success: true,
      filesWritten: dryRun ? [] : [outputPath],
      contentHash,
    };
  }

  resetState(): void {
    this.state = { allRules: [] };
  }
}

export default RooCodeMcpExporter;
