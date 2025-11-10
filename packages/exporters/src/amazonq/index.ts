import type { AlignTrueConfig } from "@aligntrue/core";

/**
 * Amazon Q exporter
 * Exports AlignTrue rules to Amazon Q .amazonq/rules/ directory format
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "../types.js";
import type { AlignRule, AlignSection } from "@aligntrue/schema";
import type { ModeHints } from "@aligntrue/core";
import { computeContentHash, isSectionBasedPack } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";
import {
  extractModeConfig,
  applyRulePrioritization,
  generateSessionPreface,
  wrapRuleWithMarkers,
  shouldIncludeRule,
} from "../utils/index.js";

export class AmazonQExporter extends ExporterBase {
  name = "amazonq";
  version = "1.0.0";

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules, pack } = request;
    const { outputDir, dryRun = false, config } = options;

    const useSections = isSectionBasedPack(pack);
    const sections = useSections ? pack.sections! : [];

    if ((!rules || rules.length === 0) && sections.length === 0) {
      throw new Error(
        "AmazonQExporter requires at least one rule or section to export",
      );
    }

    const filename = this.getScopeFilename(scope);
    const outputPath = join(outputDir, ".amazonq", "rules", filename);

    const { modeHints, maxBlocks, maxTokens } = extractModeConfig(
      this.name,
      config as AlignTrueConfig | undefined,
    );

    let content: string;
    let warnings: string[];
    let contentHash: string;
    let fidelityNotes: string[];

    if (useSections) {
      // Generate content from sections
      const { content: sectionsContent, warnings: sectionsWarnings } =
        this.generateSectionContent(scope, sections, modeHints);
      content = sectionsContent;
      warnings = sectionsWarnings;
      contentHash = computeContentHash({ scope, sections });
      fidelityNotes = this.computeSectionFidelityNotes(sections);
    } else {
      // Generate content from rules
      const { content: rulesContent, warnings: rulesWarnings } =
        this.generateRuleContent(
          scope,
          rules,
          modeHints,
          maxBlocks,
          maxTokens,
          options.unresolvedPlugsCount,
        );
      content = rulesContent;
      warnings = rulesWarnings;
      contentHash = computeContentHash({ scope, rules });
      fidelityNotes = this.computeFidelityNotes(rules);
    }

    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    const result = this.buildResult(filesWritten, contentHash, fidelityNotes);

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Generate Amazon Q content from sections (natural markdown)
   */
  private generateSectionContent(
    scope: ResolvedScope,
    sections: AlignSection[],
    modeHints: ModeHints,
  ): { content: string; warnings: string[] } {
    const lines: string[] = [];

    const scopeDesc = scope.isDefault
      ? "Amazon Q rules (default scope)"
      : `Amazon Q rules for ${scope.path}`;
    lines.push(`# ${scopeDesc}`);
    lines.push("");

    // Add session preface if needed
    lines.push(...generateSessionPreface(modeHints));

    // Render sections as natural markdown
    const sectionsMarkdown = this.renderSections(sections, false);
    lines.push(sectionsMarkdown);

    return { content: lines.join("\n"), warnings: [] };
  }

  private getScopeFilename(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "rules.md";
    }

    const normalized = scope.normalizedPath.replace(/\//g, "-");
    return `${normalized}.md`;
  }

  private generateRuleContent(
    scope: ResolvedScope,
    rules: AlignRule[],
    modeHints: ModeHints,
    maxBlocks: number,
    maxTokens: number,
    unresolvedPlugs?: number,
  ): { content: string; warnings: string[] } {
    const lines: string[] = [];

    const scopeDesc = scope.isDefault
      ? "Amazon Q rules (default scope)"
      : `Amazon Q rules for ${scope.path}`;
    lines.push(`# ${scopeDesc}`);

    // Add session preface if needed
    lines.push(...generateSessionPreface(modeHints));

    // Apply prioritization
    const { includedIds, warnings } = applyRulePrioritization(
      rules,
      modeHints,
      maxBlocks,
      maxTokens,
    );

    // Generate rule sections
    rules.forEach((rule) => {
      if (!shouldIncludeRule(rule.id, includedIds)) {
        return;
      }

      // Build rule content
      const ruleLines: string[] = [];
      ruleLines.push(`## Rule: ${rule.id}`);
      ruleLines.push("");
      ruleLines.push(`**Severity:** ${rule.severity}`);
      ruleLines.push("");

      if (rule.applies_to && rule.applies_to.length > 0) {
        ruleLines.push(`**Applies to:**`);
        rule.applies_to.forEach((pattern) => {
          ruleLines.push(`- \`${pattern}\``);
        });
        ruleLines.push("");
      }

      if (rule.guidance) {
        ruleLines.push(rule.guidance.trim());
        ruleLines.push("");
      }
      ruleLines.push("---");

      // Wrap with markers and add to output
      const ruleContent = ruleLines.join("\n");
      lines.push(wrapRuleWithMarkers(rule, ruleContent, modeHints));
      lines.push("");
    });

    const contentHash = computeContentHash({ scope, rules });
    const fidelityNotes = this.computeFidelityNotes(rules);

    lines.push("**Generated by AlignTrue**");
    lines.push(`Content Hash: ${contentHash}`);

    if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
      lines.push(`Unresolved Plugs: ${unresolvedPlugs}`);
    }

    if (fidelityNotes.length > 0) {
      lines.push("");
      lines.push("**Fidelity Notes:**");
      fidelityNotes.forEach((note) => {
        lines.push(`- ${note}`);
      });
    }

    lines.push("");
    return { content: lines.join("\n"), warnings };
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
          if (agent !== "amazonq" && agent !== "_meta") {
            crossAgentVendors.add(agent);
          }
        });
      }
    });

    if (unmappedFields.has("check")) {
      notes.push(
        "Machine-checkable rules (check) not represented in .amazonq/rules/ format",
      );
    }
    if (unmappedFields.has("autofix")) {
      notes.push("Autofix hints not represented in .amazonq/rules/ format");
    }

    if (crossAgentVendors.size > 0) {
      const agents = Array.from(crossAgentVendors).sort().join(", ");
      notes.push(
        `Vendor metadata for other agents preserved but not active: ${agents}`,
      );
    }

    notes.push(
      "applies_to patterns preserved in metadata but not enforced by Amazon Q",
    );

    return notes;
  }
}

export default AmazonQExporter;
