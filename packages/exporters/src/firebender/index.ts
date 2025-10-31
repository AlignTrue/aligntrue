/**
 * Firebender exporter
 * Exports AlignTrue rules to Firebender firebender.json format
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
import { computeContentHash } from "@aligntrue/schema";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { extractModeConfig, applyRulePrioritization } from "../utils/index.js";
import { ExporterBase } from "../base/index.js";

interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>;
}

export class FirebenderExporter extends ExporterBase {
  name = "firebender";
  version = "1.0.0";

  private state: ExporterState = {
    allRules: [],
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules } = request;
    const { outputDir, dryRun = false, config } = options;

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

    const outputPath = join(outputDir, "firebender.json");

    const { maxBlocks, maxTokens } = extractModeConfig(this.name, config);
    const { content, warnings } = this.generateFirebenderJsonContent(
      maxBlocks,
      maxTokens,
      options.unresolvedPlugsCount,
    );

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });

    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    const result = this.buildResult(filesWritten, contentHash, fidelityNotes);

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  resetState(): void {
    this.state = {
      allRules: [],
    };
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  private generateFirebenderJsonContent(
    maxBlocks: number,
    maxTokens: number,
    unresolvedPlugs?: number,
  ): { content: string; warnings: string[] } {
    // Apply prioritization before mapping rules
    const allRules = this.state.allRules.map(({ rule }) => rule);
    const { includedIds, warnings } = applyRulePrioritization(
      allRules,
      "metadata_only",
      maxBlocks,
      maxTokens,
    );

    const rules = this.state.allRules
      .filter(({ rule }) => includedIds.has(rule.id))
      .map(({ rule, scopePath }) => ({
        id: rule.id,
        severity: rule.severity,
        scope: scopePath,
        guidance: rule.guidance || "",
        applies_to: rule.applies_to || [],
        // Add mode fields to JSON objects for structured formats
        ...(rule.mode && { mode: rule.mode }),
        ...(rule.description && { description: rule.description }),
        ...(rule.tags?.length && { tags: rule.tags }),
      }));

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });
    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    const output = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      unresolved_plugs:
        unresolvedPlugs !== undefined && unresolvedPlugs > 0
          ? unresolvedPlugs
          : undefined,
      rules,
      fidelity_notes: fidelityNotes.length > 0 ? fidelityNotes : undefined,
    };

    return {
      content: JSON.stringify(output, null, 2),
      warnings,
    };
  }

  override computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = [];
    const unmappedFields = new Set<string>();
    const vendorFields = new Set<string>();

    rules.forEach((rule) => {
      if (rule.check) {
        unmappedFields.add("check");
      }
      if (rule.autofix) {
        unmappedFields.add("autofix");
      }
      if (rule.vendor) {
        Object.keys(rule.vendor).forEach((agent) => {
          if (agent !== "_meta") {
            vendorFields.add(agent);
          }
        });
      }
    });

    if (unmappedFields.has("check")) {
      notes.push(
        "Machine-checkable rules (check) not represented in firebender.json format",
      );
    }
    if (unmappedFields.has("autofix")) {
      notes.push("Autofix hints not represented in firebender.json format");
    }
    if (vendorFields.size > 0) {
      const agents = Array.from(vendorFields).sort().join(", ");
      notes.push(
        `Vendor metadata for agents preserved but not extracted: ${agents}`,
      );
    }

    return notes;
  }
}

export default FirebenderExporter;
