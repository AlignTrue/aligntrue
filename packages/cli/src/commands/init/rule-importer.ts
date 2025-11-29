import { detectNestedAgentFiles, type NestedAgentFile } from "@aligntrue/core";
import {
  parseAgentsMd,
  parseCursorMdc,
  computeContentHash,
  type RuleFrontmatter,
} from "@aligntrue/schema";
import { readFileSync } from "fs";
import { join, relative } from "path";
import type { RuleFile } from "@aligntrue/core";

export interface DetectedRule {
  file: NestedAgentFile;
  section?: {
    heading: string;
    content: string;
    // other metadata?
  };
  // or just raw content if single rule file
  rawContent?: string;
}

/**
 * Scan for existing rules in the workspace
 * @param cwd Workspace root
 */
export async function scanForExistingRules(cwd: string): Promise<RuleFile[]> {
  const detectedFiles = await detectNestedAgentFiles(cwd);
  const importedRules: RuleFile[] = [];

  for (const file of detectedFiles) {
    const content = readFileSync(file.path, "utf-8");
    const relativeDir = relative(cwd, file.directory);
    const nestedLocation = relativeDir === "" ? undefined : relativeDir;

    if (file.type === "cursor") {
      // Cursor files are typically 1 rule per file
      // We parse it to extract frontmatter if possible, or just take content
      // Cursor parser splits by sections if multiple h1s, but usually .mdc is one rule
      // Let's assume 1 file = 1 rule for now, or parse sections if multi-rule
      const parsed = parseCursorMdc(content);

      if (parsed.sections.length === 0) continue;

      // If it has multiple sections, we might want to split them into separate rules?
      // Or keep as one file?
      // Cursor exporter writes sections to separate files usually.
      // But import might find a file with multiple sections (rare for Cursor .mdc but possible)

      // For simplicity, and to preserve structure:
      // If 1 section, map to 1 file.
      // If multiple sections, map to multiple files?
      // Actually, Cursor files often have 1 H1 title.

      for (const section of parsed.sections) {
        const rule = createRuleFromSection(
          section,
          file,
          nestedLocation,
          "cursor",
        );
        importedRules.push(rule);
      }
    } else if (file.type === "agents") {
      // AGENTS.md is usually multiple rules
      const parsed = parseAgentsMd(content);

      for (const section of parsed.sections) {
        const rule = createRuleFromSection(
          section,
          file,
          nestedLocation,
          "agents",
        );
        importedRules.push(rule);
      }
    } else if (file.type === "claude") {
      // CLAUDE.md
      const parsed = parseAgentsMd(content); // Use generic markdown parser

      for (const section of parsed.sections) {
        const rule = createRuleFromSection(
          section,
          file,
          nestedLocation,
          "claude",
        );
        importedRules.push(rule);
      }
    }
  }

  return importedRules;
}

function createRuleFromSection(
  section: { heading: string; content: string },
  sourceFile: NestedAgentFile,
  nestedLocation: string | undefined,
  sourceType: string,
): RuleFile {
  // Construct frontmatter
  const now = new Date().toISOString().split("T")[0] ?? ""; // YYYY-MM-DD
  const frontmatter: RuleFrontmatter = {
    title: section.heading,
    source: sourceType,
    source_added: now,
    original_path: sourceFile.relativePath,
    ...(nestedLocation && { nested_location: nestedLocation }),
  };

  // Compute hash
  // We need content to compute hash.
  // We construct the rule content from section content.
  // Ideally we strip the heading from content if it's duplicated?
  // The parser usually includes heading in content or separates it.
  // Let's check parser behavior.
  // parseAgentsMd returns { heading, content, level, hash }
  // content usually INCLUDES the heading line in some parsers, or excludes it.
  // @aligntrue/schema parsers usually separate them.

  // We'll use the content as the body.
  const content = section.content;

  // Compute hash
  // Note: We don't have the full frontmatter yet for the final hash,
  // but we can compute content hash.
  const hash = computeContentHash(content);
  frontmatter.content_hash = hash;

  // Determine filename
  // Sanitize heading to be filename safe
  const safeName =
    section.heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled-rule";

  const filename = `${safeName}.md`;

  // Path relative to .aligntrue/rules/ (or nested)
  // We don't need to set full path here, the writer handles that.
  // But RuleFile interface expects `path`.
  // We'll use a placeholder or relative path.
  const path = nestedLocation ? join(nestedLocation, filename) : filename;

  return {
    content,
    frontmatter,
    path,
    filename,
    hash,
  };
}
