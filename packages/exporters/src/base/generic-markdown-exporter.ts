/**
 * Generic Markdown Exporter
 * Base class for all AGENTS.md-style exporters (CLAUDE.md, WARP.md, etc.)
 *
 * Provides configurable filename, title, and description while sharing
 * all core functionality: sections, rules, mode hints, prioritization, etc.
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { AlignSection } from "@aligntrue/schema";
import type { ModeHints } from "@aligntrue/core";
import { computeContentHash, isSectionBasedPack } from "@aligntrue/schema";
import { join } from "path";
import { type AlignTrueConfig } from "@aligntrue/core";
import { ExporterBase } from "./index.js";
import {
  extractModeConfig,
  applyRulePrioritization,
  generateSessionPreface,
  wrapRuleWithMarkers,
  shouldIncludeRule,
} from "../utils/index.js";

/**
 * State for collecting all scopes before generating single merged file
 */
interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>;
  allSections: Array<{ section: AlignSection; scopePath: string }>;
  seenScopes: Set<string>;
  useSections: boolean;
}

/**
 * Generic configurable markdown exporter
 * Used as delegate for agent-specific exporters
 */
export class GenericMarkdownExporter extends ExporterBase {
  name: string;
  version = "1.0.0";

  private filename: string; // e.g., "CLAUDE.md", "WARP.md"
  private title: string; // e.g., "CLAUDE.md", "WARP.md"
  private description: string; // e.g., "for Claude Code", "for Warp"

  // State for accumulating rules/sections across multiple scope calls
  private state: ExporterState = {
    allRules: [],
    allSections: [],
    seenScopes: new Set(),
    useSections: false,
  };

  constructor(
    name: string,
    filename: string,
    title: string,
    description: string,
  ) {
    super();
    this.name = name;
    this.filename = filename;
    this.title = title;
    this.description = description;
  }

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules, pack } = request;
    const { outputDir, dryRun = false, config } = options;

    // Detect if pack explicitly uses sections (not converted from rules)
    const useSections = isSectionBasedPack(pack);
    const sections = useSections ? pack.sections! : [];

    // Set mode on first call
    if (this.state.seenScopes.size === 0) {
      this.state.useSections = useSections;
    }

    // Validate inputs
    if ((!rules || rules.length === 0) && sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Accumulate content with scope information
    const scopePath = this.formatScopePath(scope);

    if (useSections) {
      sections.forEach((section) => {
        this.state.allSections.push({ section, scopePath });
      });
    } else {
      rules?.forEach((rule) => {
        this.state.allRules.push({ rule, scopePath });
      });
    }

    this.state.seenScopes.add(scopePath);

    const outputPath = join(outputDir, this.filename);

    // Get mode hints from config
    const { modeHints, maxBlocks, maxTokens } = extractModeConfig(
      this.name,
      config as AlignTrueConfig | undefined,
    );

    // Generate content based on mode
    let content: string;
    let warnings: string[] = [];
    let contentHash: string;
    let fidelityNotes: string[];

    if (this.state.useSections) {
      const result = this.generateSectionsContent(options.unresolvedPlugsCount);
      content = result.content;
      warnings = result.warnings;

      const allSectionsIR = this.state.allSections.map(
        ({ section }) => section,
      );
      contentHash = computeContentHash({ sections: allSectionsIR });
      fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);
    } else {
      const result = this.generateRulesContent(
        modeHints,
        maxBlocks,
        maxTokens,
        options.unresolvedPlugsCount,
      );
      content = result.content;
      warnings = result.warnings;

      const allRulesIR = this.state.allRules.map(({ rule }) => rule);
      contentHash = computeContentHash({ rules: allRulesIR });
      fidelityNotes = this.computeFidelityNotes(allRulesIR);
    }

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
      allSections: [],
      seenScopes: new Set(),
      useSections: false,
    };
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  private generateSectionsContent(unresolvedPlugs?: number): {
    content: string;
    warnings: string[];
  } {
    const header = this.generateHeader();
    const allSections = this.state.allSections.map(({ section }) => section);
    const sectionsMarkdown = this.renderSections(allSections, false);
    const contentHash = computeContentHash({ sections: allSections });
    const fidelityNotes = this.computeSectionFidelityNotes(allSections);
    const footer = this.generateFooter(
      contentHash,
      fidelityNotes,
      unresolvedPlugs,
    );

    return {
      content: `${header}\n\n${sectionsMarkdown}\n\n${footer}`,
      warnings: [],
    };
  }

  private generateRulesContent(
    modeHints: ModeHints,
    maxBlocks: number,
    maxTokens: number,
    unresolvedPlugs?: number,
  ): { content: string; warnings: string[] } {
    const header = this.generateHeader();
    const prefaceLines = generateSessionPreface(modeHints);
    const sessionPreface =
      prefaceLines.length > 0 ? "\n" + prefaceLines.join("\n") : "";

    const { content: ruleSections, warnings } = this.generateRuleSections(
      modeHints,
      maxBlocks,
      maxTokens,
    );

    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });
    const fidelityNotes = this.computeFidelityNotes(allRulesIR);
    const footer = this.generateFooter(
      contentHash,
      fidelityNotes,
      unresolvedPlugs,
    );

    return {
      content: `${header}${sessionPreface}\n\n${ruleSections}\n${footer}`,
      warnings,
    };
  }

  private generateHeader(): string {
    const lines: string[] = [];
    lines.push(`# ${this.title}`);
    lines.push("");
    lines.push("**Version:** v1");
    lines.push("**Generated by:** AlignTrue");
    lines.push("");
    lines.push(`This file contains rules and guidance ${this.description}.`);
    return lines.join("\n");
  }

  private generateRuleSections(
    modeHints: ModeHints,
    maxBlocks: number,
    maxTokens: number,
  ): { content: string; warnings: string[] } {
    const sections: string[] = [];
    const allRules = this.state.allRules.map(({ rule }) => rule);
    const { includedIds, warnings } = applyRulePrioritization(
      allRules,
      modeHints,
      maxBlocks,
      maxTokens,
    );

    this.state.allRules.forEach(({ rule, scopePath }) => {
      if (!shouldIncludeRule(rule.id, includedIds)) {
        return;
      }
      const section = this.generateRuleSection(rule, scopePath, modeHints);
      sections.push(section);
    });

    return { content: sections.join("\n---\n\n"), warnings };
  }

  private generateRuleSection(
    rule: AlignRule,
    scopePath: string,
    modeHints: ModeHints,
  ): string {
    const lines: string[] = [];
    lines.push(`## Rule: ${rule.id}`);
    lines.push("");
    lines.push(`**ID:** ${rule.id}`);
    lines.push(`**Severity:** ${this.mapSeverity(rule.severity)}`);
    if (scopePath) {
      lines.push(`**Scope:** ${scopePath}`);
    }
    lines.push("");
    if (rule.guidance) {
      lines.push(rule.guidance.trim());
      lines.push("");
    }
    lines.push("---");

    const ruleContent = lines.join("\n");
    return wrapRuleWithMarkers(rule, ruleContent, modeHints);
  }

  private mapSeverity(severity: "error" | "warn" | "info"): string {
    const map: Record<string, string> = {
      error: "ERROR",
      warn: "WARN",
      info: "INFO",
    };
    return map[severity] || "WARN";
  }

  private generateFooter(
    contentHash: string,
    fidelityNotes: string[],
    unresolvedPlugs?: number,
  ): string {
    const lines: string[] = [];
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

    return lines.join("\n");
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
        `Machine-checkable rules (check) not represented in ${this.filename} format`,
      );
    }
    if (unmappedFields.has("autofix")) {
      notes.push(`Autofix hints not represented in ${this.filename} format`);
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

export default GenericMarkdownExporter;
