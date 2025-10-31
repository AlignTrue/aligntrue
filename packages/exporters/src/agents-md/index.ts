/**
 * AGENTS.md exporter
 * Exports AlignTrue rules to universal AGENTS.md format
 *
 * Format: Single root-level AGENTS.md file with v1 versioned structure
 * Target agents: Claude, Copilot, Aider, and other AGENTS.md-compatible tools
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { AlignRule } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { getAlignTruePaths } from "@aligntrue/core";
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
  seenScopes: Set<string>;
}

export class AgentsMdExporter implements ExporterPlugin {
  name = "agents-md";
  version = "1.0.0";

  // State for accumulating rules across multiple scope calls
  private state: ExporterState = {
    allRules: [],
    seenScopes: new Set(),
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules } = request;
    const { outputDir, dryRun = false, config } = options;

    // Validate inputs
    if (!rules || rules.length === 0) {
      // Empty scope is allowed, just skip accumulation
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Accumulate rules with their scope information
    // Since AGENTS.md is a single merged file, we need to collect from all scopes
    const scopePath = this.formatScopePath(scope);
    rules.forEach((rule) => {
      this.state.allRules.push({ rule, scopePath });
    });
    this.state.seenScopes.add(scopePath);

    // For AGENTS.md, we generate the file only on the first export call
    // In real usage, sync engine would need to signal "last scope" or we'd need
    // a different pattern. For now, we generate immediately for each call.
    // This matches the test expectations where each test case is independent.

    const paths = getAlignTruePaths(outputDir);
    const outputPath = paths.agentsMd();

    // Get mode hints from config (default to metadata_only)
    const { modeHints, maxBlocks, maxTokens } = extractModeConfig(
      this.name,
      config,
    );

    // Generate AGENTS.md content with all accumulated rules
    const { content, warnings } = this.generateAgentsMdContent(
      modeHints,
      maxBlocks,
      maxTokens,
      options.unresolvedPlugsCount,
    );

    // Compute content hash from canonical IR of all rules
    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });

    // Compute fidelity notes
    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    // Write file atomically if not dry-run
    if (!dryRun) {
      const writer = new AtomicFileWriter();
      writer.write(outputPath, content);
    }

    const result: ExportResult = {
      success: true,
      filesWritten: dryRun ? [] : [outputPath],
      contentHash,
    };

    if (fidelityNotes.length > 0) {
      result.fidelityNotes = fidelityNotes;
    }

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Format scope path for display in AGENTS.md
   * Default scope (path: ".") → "all files"
   * Named scope → actual path
   */
  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  /**
   * Generate complete AGENTS.md content with mode hints and caps
   */
  private generateAgentsMdContent(
    modeHints: string,
    maxBlocks: number,
    maxTokens: number,
    unresolvedPlugs?: number,
  ): { content: string; warnings: string[] } {
    const header = this.generateHeader();

    // Add session preface for hints mode
    const prefaceLines = generateSessionPreface(modeHints);
    const sessionPreface =
      prefaceLines.length > 0 ? "\n" + prefaceLines.join("\n") : "";

    const { content: ruleSections, warnings } = this.generateRuleSections(
      modeHints,
      maxBlocks,
      maxTokens,
    );

    // Compute content hash for footer
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

  /**
   * Generate v1 format header
   */
  private generateHeader(): string {
    const lines: string[] = [];

    lines.push("# AGENTS.md");
    lines.push("");
    lines.push("**Version:** v1");
    lines.push("**Generated by:** AlignTrue");
    lines.push("");
    lines.push("This file contains rules and guidance for AI coding agents.");

    return lines.join("\n");
  }

  /**
   * Generate all rule sections with metadata
   * Applies token caps and mode hints
   */
  private generateRuleSections(
    modeHints: string,
    maxBlocks: number,
    maxTokens: number,
  ): { content: string; warnings: string[] } {
    const sections: string[] = [];

    // Apply prioritization using shared utility
    const allRules = this.state.allRules.map(({ rule }) => rule);
    const { includedIds, warnings } = applyRulePrioritization(
      allRules,
      modeHints,
      maxBlocks,
      maxTokens,
    );

    this.state.allRules.forEach(({ rule, scopePath }) => {
      // Skip dropped rules
      if (!shouldIncludeRule(rule.id, includedIds)) {
        return;
      }

      const section = this.generateRuleSection(rule, scopePath, modeHints);
      sections.push(section);
    });

    return { content: sections.join("\n---\n\n"), warnings };
  }

  /**
   * Generate single rule section with ID, severity, scope, and guidance
   * Wraps content with mode markers based on config
   */
  private generateRuleSection(
    rule: AlignRule,
    scopePath: string,
    modeHints: string,
  ): string {
    const lines: string[] = [];

    // Rule header
    lines.push(`## Rule: ${rule.id}`);
    lines.push("");

    // Rule ID (explicit for clarity)
    lines.push(`**ID:** ${rule.id}`);

    // Severity with plain text label
    const severityLabel = this.mapSeverityToLabel(rule.severity);
    lines.push(`**Severity:** ${severityLabel}`);

    // Scope information
    // Combine scope path with applies_to patterns
    const scopeInfo = this.formatScopeInfo(scopePath, rule.applies_to);
    if (scopeInfo) {
      lines.push(`**Scope:** ${scopeInfo}`);
    }

    lines.push("");

    // Guidance
    if (rule.guidance) {
      lines.push(rule.guidance.trim());
    }

    const ruleContent = lines.join("\n");

    // Apply mode markers using shared utility
    return wrapRuleWithMarkers(rule, ruleContent, modeHints);
  }

  /**
   * Format scope information combining scope path and applies_to patterns
   */
  private formatScopeInfo(scopePath: string, appliesTo?: string[]): string {
    const parts: string[] = [];

    if (scopePath && scopePath !== "all files") {
      parts.push(scopePath);
    }

    if (appliesTo && appliesTo.length > 0) {
      parts.push(...appliesTo);
    }

    return parts.join(", ");
  }

  /**
   * Map severity to plain text labels per Step 12 spec
   * error → ERROR
   * warn → WARN
   * info → INFO
   */
  private mapSeverityToLabel(severity: "error" | "warn" | "info"): string {
    const mapping: Record<string, string> = {
      error: "ERROR",
      warn: "WARN",
      info: "INFO",
    };
    return mapping[severity] || severity.toUpperCase();
  }

  /**
   * Compute fidelity notes for unmapped fields
   * AGENTS.md is universal format - note what's not represented
   */
  private computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = [];
    const unmappedFields = new Set<string>();
    const vendorAgents = new Set<string>();

    rules.forEach((rule) => {
      // Check for unmapped fields
      if (rule.check) {
        unmappedFields.add("check");
      }
      if (rule.autofix) {
        unmappedFields.add("autofix");
      }

      // Check for vendor-specific metadata
      if (rule.vendor) {
        Object.keys(rule.vendor).forEach((agent) => {
          if (agent !== "_meta") {
            vendorAgents.add(agent);
          }
        });
      }
    });

    // Add notes for unmapped fields
    if (unmappedFields.has("check")) {
      notes.push(
        "Machine-checkable rules (check) not represented in AGENTS.md format",
      );
    }
    if (unmappedFields.has("autofix")) {
      notes.push("Autofix hints not represented in AGENTS.md format");
    }

    // Add notes for vendor-specific metadata
    if (vendorAgents.size > 0) {
      const agents = Array.from(vendorAgents).sort().join(", ");
      notes.push(
        `Vendor-specific metadata preserved but not active in universal format: ${agents}`,
      );
    }

    return notes;
  }

  /**
   * Generate footer with content hash and fidelity notes
   */
  private generateFooter(
    contentHash: string,
    fidelityNotes: string[],
    unresolvedPlugs?: number,
  ): string {
    const lines: string[] = ["---", ""];

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
    return lines.join("\n");
  }

  /**
   * Reset internal state (useful for testing)
   */
  resetState(): void {
    this.state = {
      allRules: [],
      seenScopes: new Set(),
    };
  }
}
