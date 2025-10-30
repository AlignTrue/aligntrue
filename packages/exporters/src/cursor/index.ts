/**
 * Cursor .mdc exporter
 * Exports AlignTrue rules to Cursor's .cursor/rules/*.mdc format
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { AlignRule } from "@aligntrue/schema";
import { canonicalizeJson, computeHash } from "@aligntrue/schema";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { getAlignTruePaths } from "@aligntrue/core";

export class CursorExporter implements ExporterPlugin {
  name = "cursor";
  version = "1.0.0";

  // NOTE: Cursor always uses native frontmatter format (modeHints='native')
  // This ensures round-trip fidelity for vendor.cursor fields
  // The mode_hints config is intentionally ignored for this exporter

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, rules } = request;
    const { outputDir, dryRun = false } = options;

    // Validate inputs
    if (!rules || rules.length === 0) {
      throw new Error("CursorExporter requires at least one rule to export");
    }

    // Cursor always uses native frontmatter format, ignore config
    // This preserves round-trip fidelity for vendor.cursor fields
    const modeHints = "native"; // Force native, ignore config

    // Compute scope-specific filename using centralized paths
    const paths = getAlignTruePaths(outputDir);
    const filename = this.getScopeFilename(scope);
    const outputPath = paths.cursorRules(
      scope.isDefault ? "default" : scope.normalizedPath,
    );

    // Generate .mdc content
    const content = this.generateMdcContent(scope, rules);

    // Compute content hash from canonical IR
    const irContent = JSON.stringify({ scope, rules });
    const contentHash = computeHash(canonicalizeJson(irContent));

    // Compute fidelity notes
    const fidelityNotes = this.computeFidelityNotes(rules);

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

    return result;
  }

  /**
   * Generate scope-specific filename
   * Default scope (path: ".") → "aligntrue.mdc"
   * Named scope → "{normalized-path}.mdc" (slashes → hyphens)
   */
  private getScopeFilename(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "aligntrue.mdc";
    }

    // Normalize path: replace slashes with hyphens
    const normalized = scope.normalizedPath.replace(/\//g, "-");
    return `${normalized}.mdc`;
  }

  /**
   * Generate complete .mdc file content
   */
  private generateMdcContent(
    scope: ResolvedScope,
    rules: AlignRule[],
    unresolvedPlugs?: number,
  ): string {
    const frontmatter = this.generateFrontmatter(scope, rules);
    const rulesSections = this.generateRulesSections(rules);
    const irContent = JSON.stringify({ scope, rules });
    const contentHash = computeHash(canonicalizeJson(irContent));
    const fidelityNotes = this.computeFidelityNotes(rules);
    const footer = generateMdcFooter(
      contentHash,
      fidelityNotes,
      unresolvedPlugs,
    );

    return `${frontmatter}\n${rulesSections}\n${footer}`;
  }

  /**
   * Generate YAML frontmatter from scope and rules
   */
  private generateFrontmatter(
    scope: ResolvedScope,
    rules: AlignRule[],
  ): string {
    // Use first rule's mode (file-level in Cursor)
    const firstRule = rules[0];
    if (!firstRule) {
      return "";
    }

    const lines: string[] = ["---"];

    // Map mode enum back to Cursor boolean fields
    if (firstRule.mode === "always") {
      lines.push("alwaysApply: true");
    } else if (firstRule.mode === "intelligent") {
      lines.push("intelligent: true");
      if (firstRule.description) {
        lines.push(`description: ${firstRule.description}`);
      }
    }

    // Always prefer vendor.cursor.globs for byte-identical round-trips
    const globs = firstRule.vendor?.["cursor"]?.globs || firstRule.applies_to;
    if (globs && globs.length > 0) {
      // Only export if non-default pattern
      const hasSpecificGlobs = !(globs.length === 1 && globs[0] === "**/*");
      if (hasSpecificGlobs) {
        lines.push(`globs:`);
        globs.forEach((glob: string) => {
          lines.push(`  - "${glob}"`);
        });
      }
    }

    // Export title and tags if present
    if (firstRule.title) {
      lines.push(`title: ${firstRule.title}`);
    }
    if (firstRule.tags && firstRule.tags.length > 0) {
      lines.push("tags:");
      firstRule.tags.forEach((tag) => {
        lines.push(`  - ${tag}`);
      });
    }

    // Restore any unknown fields from vendor.cursor._unknown
    if (firstRule.vendor?.["cursor"]?.["_unknown"]) {
      const unknown = firstRule.vendor["cursor"]["_unknown"] as Record<
        string,
        any
      >;
      Object.entries(unknown).forEach(([key, value]) => {
        if (typeof value === "string") {
          lines.push(`${key}: ${value}`);
        } else if (Array.isArray(value)) {
          lines.push(`${key}:`);
          value.forEach((item) => {
            lines.push(
              `  - ${typeof item === "string" ? item : JSON.stringify(item)}`,
            );
          });
        } else {
          lines.push(`${key}: ${JSON.stringify(value)}`);
        }
      });
    }

    // Extract per-rule vendor.cursor metadata (excluding _unknown)
    const cursorPerRuleMetadata: Record<string, any> = {};
    rules.forEach((rule) => {
      const vendorCursor = this.extractPerRuleVendorCursor(rule);
      if (Object.keys(vendorCursor).length > 0) {
        cursorPerRuleMetadata[rule.id] = vendorCursor;
      }
    });

    // Add cursor per-rule metadata if present
    if (Object.keys(cursorPerRuleMetadata).length > 0) {
      lines.push("cursor:");
      Object.entries(cursorPerRuleMetadata).forEach(([ruleId, metadata]) => {
        lines.push(`  ${ruleId}:`);
        Object.entries(metadata).forEach(([key, value]) => {
          if (typeof value === "string") {
            lines.push(`    ${key}: "${value}"`);
          } else {
            lines.push(`    ${key}: ${JSON.stringify(value)}`);
          }
        });
      });
    }

    lines.push("---");
    return lines.join("\n");
  }

  /**
   * Generate rule sections with markdown headers
   */
  private generateRulesSections(rules: AlignRule[]): string {
    const sections: string[] = [];

    rules.forEach((rule) => {
      const lines: string[] = [];

      // Rule header
      lines.push(`## Rule: ${rule.id}`);
      lines.push("");

      // Severity
      lines.push(`**Severity:** ${rule.severity}`);
      lines.push("");

      // Applies to patterns
      if (rule.applies_to && rule.applies_to.length > 0) {
        lines.push(`**Applies to:**`);
        rule.applies_to.forEach((pattern) => {
          lines.push(`- \`${pattern}\``);
        });
        lines.push("");
      }

      // Guidance
      if (rule.guidance) {
        lines.push(rule.guidance.trim());
        lines.push("");
      }

      sections.push(lines.join("\n"));
    });

    return sections.join("\n");
  }

  /**
   * Extract per-rule vendor.cursor metadata from a rule
   * Excludes file-level fields (alwaysApply, intelligent, description, globs) and _unknown
   */
  private extractPerRuleVendorCursor(rule: AlignRule): Record<string, any> {
    if (!rule.vendor || !rule.vendor["cursor"]) {
      return {};
    }

    const cursor = rule.vendor["cursor"] as Record<string, any>;
    const metadata: Record<string, any> = {};
    const excludedFields = new Set([
      "alwaysApply",
      "intelligent",
      "description",
      "globs",
      "_meta",
      "_unknown",
    ]);

    // Extract cursor-specific fields that are not file-level or _unknown
    Object.entries(cursor).forEach(([key, value]) => {
      // Skip excluded fields
      if (excludedFields.has(key)) return;
      metadata[key] = value;
    });

    return metadata;
  }

  /**
   * Compute fidelity notes for unmapped fields
   */
  private computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = [];
    const unmappedFields = new Set<string>();
    const crossAgentVendors = new Set<string>();

    rules.forEach((rule) => {
      // Check for unmapped fields
      if (rule.check) {
        unmappedFields.add("check");
      }
      if (rule.autofix) {
        unmappedFields.add("autofix");
      }

      // Check for cross-agent vendor fields
      if (rule.vendor) {
        Object.keys(rule.vendor).forEach((agent) => {
          if (agent !== "cursor" && agent !== "_meta") {
            crossAgentVendors.add(agent);
          }
        });
      }
    });

    // Add notes for unmapped fields
    if (unmappedFields.has("check")) {
      notes.push(
        "Machine-checkable rules (check) not represented in .mdc format",
      );
    }
    if (unmappedFields.has("autofix")) {
      notes.push("Autofix hints not represented in .mdc format");
    }

    // Add notes for cross-agent vendor fields
    if (crossAgentVendors.size > 0) {
      const agents = Array.from(crossAgentVendors).sort().join(", ");
      notes.push(
        `Vendor metadata for other agents preserved but not active: ${agents}`,
      );
    }

    // Add general scope limitation note
    notes.push(
      "applies_to patterns preserved in metadata but not enforced by Cursor",
    );

    return notes;
  }
}

/**
 * Generate .mdc file footer with content hash and fidelity notes
 * @param contentHash - SHA-256 hash of the canonical IR content
 * @param fidelityNotes - Array of semantic mapping limitations
 */
export function generateMdcFooter(
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
