/**
 * Gemini CLI Config exporter
 * Exports AlignTrue rules to .gemini/settings.json format
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

export class GeminiConfigExporter extends ExporterBase {
  name = "gemini-config";
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

    const outputPath = join(outputDir, ".gemini", "settings.json");
    const config: Record<string, unknown> = {
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
      config["unresolved_plugs"] = options.unresolvedPlugsCount;
    }

    const content = JSON.stringify(config, null, 2) + "\n";

    if (!dryRun) {
      mkdirSync(dirname(outputPath), { recursive: true });
      new AtomicFileWriter().write(outputPath, content);
    }

    return {
      success: true,
      filesWritten: dryRun ? [] : [outputPath],
      contentHash: (config["content_hash"] as string) || "",
    };
  }

  resetState(): void {
    this.state = { allRules: [] };
  }
}

export default GeminiConfigExporter;
