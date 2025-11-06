/**
 * Cursor .mdc parser
 * Parses .cursor/rules/*.mdc files back to IR format
 */

import { parse as parseYaml } from "yaml";
import type { AlignRule } from "@aligntrue/schema";

export interface CursorParseResult {
  rules: AlignRule[];
  vendorMetadata: Record<string, unknown>;
}

/**
 * Parse Cursor .mdc file content to IR format
 */
export function parseCursorMdc(content: string): CursorParseResult {
  const rules: AlignRule[] = [];
  const vendorMetadata: Record<string, unknown> = {};
  const fileLevelMetadata: Record<string, unknown> = {};

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch && frontmatterMatch[1]) {
    const frontmatter = parseYaml(frontmatterMatch[1]) as Record<
      string,
      unknown
    >;

    if (frontmatter) {
      // Capture file-level Cursor execution mode fields
      if ("alwaysApply" in frontmatter)
        fileLevelMetadata["alwaysApply"] = frontmatter["alwaysApply"];
      if ("intelligent" in frontmatter)
        fileLevelMetadata["intelligent"] = frontmatter["intelligent"];
      if ("description" in frontmatter)
        fileLevelMetadata["description"] = frontmatter["description"];
      if ("globs" in frontmatter)
        fileLevelMetadata["globs"] = frontmatter["globs"];

      // Capture any other Cursor-specific fields (future-proof)
      Object.keys(frontmatter).forEach((key) => {
        if (
          ![
            "cursor",
            "alwaysApply",
            "intelligent",
            "description",
            "globs",
          ].includes(key)
        ) {
          fileLevelMetadata[key] = frontmatter[key];
        }
      });

      // Extract per-rule vendor.cursor metadata from frontmatter
      if (frontmatter["cursor"]) {
        Object.assign(vendorMetadata, frontmatter["cursor"]);
      }
    }
  }

  // Extract rule sections (## Rule: <name>)
  const ruleSectionRegex =
    /## Rule: ([^\n]+)\n\n([\s\S]*?)(?=\n## Rule: |\n---\n|$)/g;
  let match;

  while ((match = ruleSectionRegex.exec(content)) !== null) {
    if (match[1] && match[2]) {
      const ruleId = match[1].trim();
      const ruleBody = match[2].trim();

      const rule = parseRuleSection(
        ruleId,
        ruleBody,
        fileLevelMetadata,
        vendorMetadata,
      );
      if (rule) {
        rules.push(rule);
      }
    }
  }

  return { rules, vendorMetadata };
}

/**
 * Normalize rule ID to dot notation
 */
function normalizeRuleId(id: string): {
  normalized: string;
  converted: boolean;
} {
  // If already dot notation, return as-is
  if (/^[a-z0-9]+(\.[a-z0-9-]+){2,}$/.test(id)) {
    return { normalized: id, converted: false };
  }

  // Convert kebab-case to dot notation (must have at least 2 hyphens for 3 segments)
  if (/^[a-z0-9]+(-[a-z0-9]+){2,}$/.test(id)) {
    return { normalized: id.replace(/-/g, "."), converted: true };
  }

  // Return as-is if doesn't match either pattern (will fail schema validation)
  return { normalized: id, converted: false };
}

/**
 * Parse individual rule section
 */
function parseRuleSection(
  ruleId: string,
  body: string,
  fileLevelMetadata: Record<string, unknown>,
  perRuleMetadata: Record<string, unknown>,
): AlignRule | null {
  // Normalize rule ID
  const { normalized, converted } = normalizeRuleId(ruleId);
  if (converted) {
    console.log(`  ℹ Converted rule ID: ${ruleId} → ${normalized}`);
  }

  // Extract severity (required)
  const severityMatch = body.match(/\*\*Severity:\*\*\s+(error|warn|info)/i);
  if (!severityMatch || !severityMatch[1]) {
    console.warn(`Cursor parser: No severity found for rule ${normalized}`);
    return null;
  }
  const severity = severityMatch[1].toLowerCase() as "error" | "warn" | "info";

  // Extract applies_to patterns
  const appliesToMatch = body.match(/\*\*Applies to:\*\*\n((?:- `[^`]+`\n?)+)/);
  const applies_to: string[] = [];
  if (appliesToMatch && appliesToMatch[1]) {
    const patterns = appliesToMatch[1].matchAll(/- `([^`]+)`/g);
    for (const pattern of patterns) {
      if (pattern[1]) {
        applies_to.push(pattern[1]);
      }
    }
  }

  // Extract guidance (everything after applies_to or severity)
  let guidance = body;
  // Remove severity line
  guidance = guidance.replace(/\*\*Severity:\*\*\s+\w+\n\n/, "");
  // Remove applies_to section
  guidance = guidance.replace(/\*\*Applies to:\*\*\n(?:- `[^`]+`\n?)+\n?/, "");
  guidance = guidance.trim();

  // Map Cursor frontmatter to core schema fields
  const mode: "always" | "manual" | "intelligent" | "files" = fileLevelMetadata[
    "alwaysApply"
  ]
    ? "always"
    : fileLevelMetadata["intelligent"]
      ? "intelligent"
      : fileLevelMetadata["globs"]
        ? "files"
        : "manual";

  // Build rule with schema fields
  const globs = fileLevelMetadata["globs"];
  const appliesToValue = Array.isArray(globs) ? globs : ["**/*"];
  const description = fileLevelMetadata["description"];
  const title = fileLevelMetadata["title"];
  const tags = fileLevelMetadata["tags"];

  const rule: AlignRule = {
    id: normalized,
    severity,
    applies_to: applies_to.length > 0 ? applies_to : appliesToValue,
    mode,
    ...(typeof description === "string" ? { description } : {}),
    ...(typeof title === "string" ? { title } : {}),
    ...(Array.isArray(tags) ? { tags } : {}),
    ...(guidance ? { guidance } : {}),
  };

  // Safety: preserve unknown Cursor fields
  const knownFields = [
    "alwaysApply",
    "intelligent",
    "globs",
    "description",
    "title",
    "tags",
  ];
  const unknownFields = Object.keys(fileLevelMetadata).filter(
    (k) => !knownFields.includes(k),
  );
  const hasPerRuleMetadata = perRuleMetadata[ruleId];

  if (unknownFields.length > 0 || hasPerRuleMetadata) {
    const unknownObj = unknownFields.reduce(
      (acc, k) => {
        acc[k] = fileLevelMetadata[k];
        return acc;
      },
      {} as Record<string, unknown>,
    );

    const perRuleMeta =
      hasPerRuleMetadata && typeof perRuleMetadata[ruleId] === "object"
        ? (perRuleMetadata[ruleId] as Record<string, unknown>)
        : {};
    rule.vendor = {
      cursor: {
        ...(unknownFields.length > 0 ? { _unknown: unknownObj } : {}),
        ...perRuleMeta,
      },
    };
  }

  return rule;
}

/**
 * Parse multiple .mdc files and merge rules
 */
export function parseCursorMdcFiles(files: Map<string, string>): AlignRule[] {
  const allRules: AlignRule[] = [];
  const seenIds = new Set<string>();

  for (const [_filepath, content] of files.entries()) {
    const { rules } = parseCursorMdc(content);

    // Deduplicate by ID (last wins)
    for (const rule of rules) {
      if (seenIds.has(rule.id)) {
        // Remove previous version
        const index = allRules.findIndex((r) => r.id === rule.id);
        if (index >= 0) {
          allRules.splice(index, 1);
        }
      }

      allRules.push(rule);
      seenIds.add(rule.id);
    }
  }

  return allRules;
}
