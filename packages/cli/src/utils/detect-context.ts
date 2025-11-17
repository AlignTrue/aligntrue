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
 * Detected agent information
 */
export interface DetectedAgent {
  /** Agent name (cursor, agents-md, claude, etc.) */
  agent: string;
  /** Files found for this agent */
  files: string[];
  /** Estimated rule count (if available) */
  ruleCount?: number;
}

/**
 * Result of context detection
 */
export interface ContextResult {
  /** Detected context type (primary context for backwards compat) */
  context: ProjectContext;
  /** Existing files found (all files from all agents) */
  existingFiles: string[];
  /** All detected agents */
  allDetectedAgents: DetectedAgent[];
}

/**
 * Detect project context to determine init flow
 * @param cwd - Directory to check (defaults to process.cwd())
 * @returns Context result with detected type and existing files
 */
export function detectContext(cwd: string = process.cwd()): ContextResult {
  const allDetectedAgents: DetectedAgent[] = [];
  const existingFiles: string[] = [];

  // Check for .aligntrue/ directory
  const aligntruePath = join(cwd, ".aligntrue");
  if (existsSync(aligntruePath) && statSync(aligntruePath).isDirectory()) {
    existingFiles.push(".aligntrue/");
    return {
      context: "already-initialized",
      existingFiles,
      allDetectedAgents: [],
    };
  }

  // Fallback: treat standalone lockfile or bundle as initialized
  const standaloneArtifacts = [
    {
      path: join(cwd, ".aligntrue.lock.json"),
      label: ".aligntrue.lock.json",
    },
    {
      path: join(cwd, ".aligntrue.bundle.yaml"),
      label: ".aligntrue.bundle.yaml",
    },
  ].filter(({ path }) => existsSync(path));

  if (standaloneArtifacts.length > 0) {
    existingFiles.push(...standaloneArtifacts.map((a) => a.label));
    return {
      context: "already-initialized",
      existingFiles,
      allDetectedAgents: [],
    };
  }

  // Check for .cursor/rules/ directory
  const cursorRulesPath = join(cwd, ".cursor", "rules");
  if (existsSync(cursorRulesPath) && statSync(cursorRulesPath).isDirectory()) {
    try {
      const files = readdirSync(cursorRulesPath);
      const mdcFiles = files.filter((f) => f.endsWith(".mdc"));
      if (mdcFiles.length > 0) {
        allDetectedAgents.push({
          agent: "cursor",
          files: [".cursor/rules/"],
        });
        existingFiles.push(".cursor/rules/");
      }
    } catch {
      // Directory not readable, continue
    }
  }

  // Check for legacy .cursorrules file
  const cursorrulesPath = join(cwd, ".cursorrules");
  if (existsSync(cursorrulesPath)) {
    allDetectedAgents.push({
      agent: "cursorrules",
      files: [".cursorrules"],
    });
    existingFiles.push(".cursorrules");
  }

  // Check for markdown format files (case-insensitive)
  const markdownFormats = [
    {
      baseNames: ["AGENTS", "agents", "Agents"],
      agent: "agents-md",
    },
    {
      baseNames: ["CLAUDE", "claude", "Claude"],
      agent: "claude",
    },
    {
      baseNames: ["CRUSH", "crush", "Crush"],
      agent: "crush",
    },
    {
      baseNames: ["WARP", "warp", "Warp"],
      agent: "warp",
    },
  ];

  for (const { baseNames, agent } of markdownFormats) {
    for (const baseName of baseNames) {
      const fileName = `${baseName}.md`;
      const filePath = join(cwd, fileName);
      if (existsSync(filePath)) {
        allDetectedAgents.push({
          agent,
          files: [fileName],
        });
        existingFiles.push(fileName);
        break; // Only add once per agent
      }
    }
  }

  // Determine primary context (highest priority agent for backwards compat)
  let context: ProjectContext = "fresh-start";
  if (allDetectedAgents.length > 0 && allDetectedAgents[0]) {
    const firstAgent = allDetectedAgents[0].agent;
    switch (firstAgent) {
      case "cursor":
        context = "import-cursor";
        break;
      case "cursorrules":
        context = "import-cursorrules";
        break;
      case "agents-md":
        context = "import-agents";
        break;
      case "claude":
        context = "import-claude";
        break;
      case "crush":
        context = "import-crush";
        break;
      case "warp":
        context = "import-warp";
        break;
    }
  }

  return {
    context,
    existingFiles,
    allDetectedAgents,
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
