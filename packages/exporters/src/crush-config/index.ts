/**
 * Crush Config exporter
 * Exports AlignTrue rules to .crush.json format
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import type { AlignRule } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>;
}

export class CrushConfigExporter extends ExporterBase {
  name = "crush-config";
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

    const outputPath = join(outputDir, ".crush.json");
    const config: Record<string, any> = {
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

    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    return this.buildResult(filesWritten, config["content_hash"]);
  }

  resetState(): void {
    this.state = { allRules: [] };
  }
}

export default CrushConfigExporter;
