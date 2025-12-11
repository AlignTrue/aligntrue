import { posix as path } from "path";

import type { AlignSection } from "@aligntrue/schema";

export interface GitignoreRuleExport {
  sourceFile: string;
  exportPaths: string[];
}

/**
 * Compute exporter output paths for rules marked gitignore: true.
 * Currently supports Cursor multi-file outputs (.cursor/rules/*.mdc).
 */
export function computeGitignoreRuleExports(
  sections: AlignSection[],
  exporterNames: string[],
): GitignoreRuleExport[] {
  const gitignoreSections = sections.filter(
    (section) => section.vendor?.aligntrue?.frontmatter?.gitignore === true,
  );

  if (gitignoreSections.length === 0) return [];

  const supportsCursor = exporterNames.includes("cursor");

  return gitignoreSections
    .map((section) => {
      const sourceFile =
        section.source_file || section.explicitId || section.fingerprint || "";

      const exportPaths: string[] = [];

      if (supportsCursor) {
        const filename = deriveFilenameFromSource(sourceFile);
        const nestedLoc =
          section.vendor?.aligntrue?.frontmatter?.nested_location;
        const baseDir = nestedLoc
          ? path.join(normalizeNestedLocation(nestedLoc), ".cursor", "rules")
          : path.join(".cursor", "rules");
        exportPaths.push(path.join(baseDir, filename));
      }

      if (exportPaths.length === 0) {
        return null;
      }

      return {
        sourceFile,
        exportPaths,
      };
    })
    .filter((item): item is GitignoreRuleExport => Boolean(item));
}

function deriveFilenameFromSource(sourceFile: string): string {
  // Normalize backslashes before taking basename to avoid Windows paths leaking directories
  const normalized = (sourceFile || "rule.md").replace(/\\/g, "/");
  const base = path.basename(normalized);
  if (base.toLowerCase().endsWith(".md")) {
    return base.slice(0, -3) + ".mdc";
  }
  if (base.toLowerCase().endsWith(".mdc")) {
    return base;
  }
  return `${base}.mdc`;
}

function normalizeNestedLocation(nested: string): string {
  return nested.replace(/\\/g, "/").replace(/^\/+/, "");
}
