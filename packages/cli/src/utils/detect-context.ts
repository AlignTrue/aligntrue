/**
 * Context detection for init command
 * Determines what user flow to offer based on project state
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Project context types
 */
export type ProjectContext =
  | "already-initialized" // Has .aligntrue/ directory
  | "import-cursor" // Has .cursor/rules/ but no .aligntrue/
  | "import-cursorrules" // Has .cursorrules but no .aligntrue/
  | "import-agents" // Has AGENTS.md but no .aligntrue/
  | "import-claude" // Has CLAUDE.md but no .aligntrue/
  | "import-crush" // Has CRUSH.md but no .aligntrue/
  | "import-warp" // Has WARP.md but no .aligntrue/
  | "fresh-start"; // No existing rules or config

/**
 * Result of context detection
 */
export interface ContextResult {
  /** Detected context type */
  context: ProjectContext;
  /** Existing files found */
  existingFiles: string[];
}

/**
 * Detect project context to determine init flow
 * @param cwd - Directory to check (defaults to process.cwd())
 * @returns Context result with detected type and existing files
 */
export function detectContext(cwd: string = process.cwd()): ContextResult {
  const existingFiles: string[] = [];

  // Check for .aligntrue/ directory
  const aligntruePath = join(cwd, ".aligntrue");
  if (existsSync(aligntruePath) && statSync(aligntruePath).isDirectory()) {
    existingFiles.push(".aligntrue/");
    return {
      context: "already-initialized",
      existingFiles,
    };
  }

  // Check for .cursor/rules/ directory (Priority 1: Most specific format)
  const cursorRulesPath = join(cwd, ".cursor", "rules");
  if (existsSync(cursorRulesPath) && statSync(cursorRulesPath).isDirectory()) {
    // Check if it has any .mdc files
    try {
      const files = readdirSync(cursorRulesPath);
      const mdcFiles = files.filter((f) => f.endsWith(".mdc"));
      if (mdcFiles.length > 0) {
        existingFiles.push(".cursor/rules/");
        return {
          context: "import-cursor",
          existingFiles,
        };
      }
    } catch (err) {
      // Directory not readable, continue
    }
  }

  // Check for legacy .cursorrules file (Priority 2: Legacy Cursor format)
  const cursorrulesPath = join(cwd, ".cursorrules");
  if (existsSync(cursorrulesPath)) {
    existingFiles.push(".cursorrules");
    return {
      context: "import-cursorrules",
      existingFiles,
    };
  }

  // Check for markdown format files (Priority 2-5: Case-insensitive)
  // Order: AGENTS.md, CLAUDE.md, CRUSH.md, WARP.md
  const markdownFormats = [
    {
      baseNames: ["AGENTS", "agents", "Agents"],
      context: "import-agents" as const,
    },
    {
      baseNames: ["CLAUDE", "claude", "Claude"],
      context: "import-claude" as const,
    },
    {
      baseNames: ["CRUSH", "crush", "Crush"],
      context: "import-crush" as const,
    },
    { baseNames: ["WARP", "warp", "Warp"], context: "import-warp" as const },
  ];

  for (const { baseNames, context } of markdownFormats) {
    for (const baseName of baseNames) {
      const fileName = `${baseName}.md`;
      const filePath = join(cwd, fileName);
      if (existsSync(filePath)) {
        existingFiles.push(fileName);
        return {
          context,
          existingFiles,
        };
      }
    }
  }

  // Default: fresh start
  return {
    context: "fresh-start",
    existingFiles: [],
  };
}

/**
 * Get human-readable description of context
 */
export function getContextDescription(context: ProjectContext): string {
  switch (context) {
    case "already-initialized":
      return "AlignTrue already initialized";
    case "import-cursor":
      return "Existing Cursor rules found";
    case "import-cursorrules":
      return "Existing .cursorrules found";
    case "import-agents":
      return "Existing AGENTS.md found";
    case "import-claude":
      return "Existing CLAUDE.md found";
    case "import-crush":
      return "Existing CRUSH.md found";
    case "import-warp":
      return "Existing WARP.md found";
    case "fresh-start":
      return "Starting fresh";
  }
}
