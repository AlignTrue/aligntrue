/**
 * Firebase Studio MCP config exporter
 * Exports AlignTrue rules to .idx/mcp.json format
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
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
}

export class FirebaseMcpExporter implements ExporterPlugin {
  name = "firebase-mcp";
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

    const outputPath = join(outputDir, ".idx", "mcp.json");
    const mcpConfig: Record<string, any> = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: computeHash(
        canonicalizeJson(
          JSON.stringify({
            rules: this.state.allRules.map(({ rule }) => rule),
          }),
        ),
      ),
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
      mcpConfig.unresolved_plugs = options.unresolvedPlugsCount;
    }

    const content = JSON.stringify(mcpConfig, null, 2) + "\n";
    const contentHash = mcpConfig.content_hash;

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

export default FirebaseMcpExporter;
