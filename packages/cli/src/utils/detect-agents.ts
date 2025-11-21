/**
 * Agent detection utility
 * Detects installed AI coding agents by checking for their output files/directories
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Detection patterns for all 28 agents
 * Maps agent name to detection patterns (files/directories to check)
 */
export const AGENT_PATTERNS: Record<string, string[]> = {
  // Core exporters
  cursor: [".cursor/rules/"], // Only detect if rules subdirectory exists
  agents: ["AGENTS.md"],
  "vscode-mcp": [".vscode/mcp.json"], // Only detect if MCP config exists

  // MCP config exporters
  "cursor-mcp": [".cursor/mcp.json"], // Only detect if MCP config exists
  "root-mcp": [".mcp.json"],
  "windsurf-mcp": [".windsurf/mcp_config.json"], // Only detect if MCP config exists
  "amazonq-mcp": [".amazonq/mcp.json"], // Only detect if MCP config exists
  "firebase-mcp": [".idx/mcp.json"], // Only detect if MCP config exists
  "kilocode-mcp": [".kilocode/mcp.json"], // Only detect if MCP config exists
  "roocode-mcp": [".roo/mcp.json"], // Only detect if MCP config exists
  "amp-mcp": [".amp/settings.json"], // Only detect if MCP config exists
  "junie-mcp": [".junie/mcp/mcp.json"], // Only detect if MCP config exists
  "augmentcode-mcp": [".augment/settings.json"], // Only detect if MCP config exists
  "goose-mcp": [".goose/config.yaml"], // Only detect if MCP config exists
  "kiro-mcp": [".kiro/settings/mcp.json"], // Only detect if MCP config exists
  "traeai-mcp": ["trae_config.yaml"], // Only detect if MCP config exists

  // Markdown format exporters
  claude: ["CLAUDE.md"],
  crush: ["CRUSH.md"],
  warp: ["WARP.md"],
  gemini: ["GEMINI.md"],
  // Note: agents that share AGENTS.md are intentionally not auto-detected
  // Users must explicitly enable them if needed

  // Plain text format exporters
  cline: [".clinerules"],
  goose: [".goosehints"],

  // JSON/Config format exporters
  firebender: ["firebender.json"],
  "crush-config": [".crush.json"],
  "opencode-config": ["opencode.json"],
  "gemini-config": [".gemini/settings.json"], // Only detect if config exists
  "qwen-config": [".qwen/settings.json"], // Only detect if config exists
  "zed-config": [".zed/settings.json"], // Only detect if config exists
  "codex-config": [".codex/config.toml"], // Only detect if config exists
  "openhands-config": ["config.toml"],

  // Directory-based exporters
  amazonq: [".amazonq/rules/"], // Only detect if rules subdirectory exists
  augmentcode: [".augment/rules/"], // Only detect if rules subdirectory exists
  kilocode: [".kilocode/rules/"], // Only detect if rules subdirectory exists
  kiro: [".kiro/steering/"], // Only detect if steering subdirectory exists
  "firebase-studio": [".idx/airules.md"], // Only detect if specific file exists
  junie: [".junie/guidelines.md"], // Only detect if specific file exists
  "trae-ai": [".trae/rules/project_rules.md"], // Only detect if specific file exists
  openhands: [".openhands/microagents/repo.md"], // Only detect if specific file exists

  // YAML config exporters
  "aider-config": [".aider.conf.yml"],
};

/**
 * Human-readable display names for agents (includes all agents, not just auto-detected)
 */
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  cursor: "Cursor",
  agents: "Universal AGENTS.md",
  "vscode-mcp": "VS Code MCP",
  "cursor-mcp": "Cursor MCP",
  "root-mcp": "Root MCP (Claude Code, Aider)",
  "windsurf-mcp": "Windsurf MCP",
  "amazonq-mcp": "Amazon Q MCP",
  "firebase-mcp": "Firebase Studio MCP",
  "kilocode-mcp": "Kilocode MCP",
  "roocode-mcp": "Roo Code MCP",
  claude: "Claude (CLAUDE.md)",
  crush: "Crush (CRUSH.md)",
  warp: "Warp (WARP.md)",
  gemini: "Gemini (GEMINI.md)",
  copilot: "GitHub Copilot",
  jules: "Jules",
  amp: "Amp",
  "openai-codex": "OpenAI Codex",
  windsurf: "Windsurf",
  aider: "Aider",
  "gemini-cli": "Gemini CLI",
  "qwen-code": "Qwen Code",
  roocode: "Roo Code",
  zed: "Zed",
  opencode: "Open Code",
  cline: "Cline",
  goose: "Goose",
  firebender: "Firebender",
  "crush-config": "Crush Config",
  "opencode-config": "Open Code Config",
  "gemini-config": "Gemini Config",
  "qwen-config": "Qwen Config",
  "zed-config": "Zed Config",
  "codex-config": "Codex Config",
  "openhands-config": "OpenHands Config",
  amazonq: "Amazon Q",
  augmentcode: "Augment Code",
  kilocode: "Kilocode",
  kiro: "Kiro",
  "firebase-studio": "Firebase Studio",
  junie: "Junie",
  "trae-ai": "Trae AI",
  openhands: "OpenHands",
  "aider-config": "Aider Config",
};

/**
 * Result of agent detection (basic detection without validation)
 */
export interface BasicDetectionResult {
  /** List of detected agent names */
  detected: string[];
  /** Recommended agents to enable (same as detected) */
  recommended: string[];
  /** Display names for detected agents */
  displayNames: Map<string, string>;
}

/**
 * Detect agents in the given directory
 * @param cwd - Directory to check (defaults to process.cwd())
 * @returns Detection result with detected and recommended agents
 */
export function detectAgents(
  cwd: string = process.cwd(),
): BasicDetectionResult {
  const detected: string[] = [];
  const displayNames = new Map<string, string>();

  for (const [agentName, patterns] of Object.entries(AGENT_PATTERNS)) {
    // Check if any of the patterns exist
    const found = patterns.some((pattern) => {
      const fullPath = join(cwd, pattern);
      return existsSync(fullPath);
    });

    if (found) {
      detected.push(agentName);
      displayNames.set(agentName, AGENT_DISPLAY_NAMES[agentName] || agentName);
    }
  }

  return {
    detected,
    recommended: detected, // For now, recommend all detected
    displayNames,
  };
}

/**
 * Get display name for an agent
 */
export function getAgentDisplayName(agentName: string): string {
  return AGENT_DISPLAY_NAMES[agentName] || agentName;
}

/**
 * Get all available agent names
 */
export function getAllAgents(): string[] {
  return Object.keys(AGENT_PATTERNS);
}

/**
 * Detect agents not in config and not ignored
 * @param cwd - Directory to check
 * @param currentExporters - Currently enabled exporters
 * @param ignoredAgents - Agents user has chosen to ignore
 * @returns New agents with file paths
 */
export function detectNewAgents(
  cwd: string,
  currentExporters: string[],
  ignoredAgents: string[],
): Array<{ name: string; displayName: string; filePath: string }> {
  const allDetected = detectAgents(cwd);
  const currentSet = new Set(currentExporters);
  const ignoredSet = new Set(ignoredAgents);

  const newAgents: Array<{
    name: string;
    displayName: string;
    filePath: string;
  }> = [];

  for (const agentName of allDetected.detected) {
    if (!currentSet.has(agentName) && !ignoredSet.has(agentName)) {
      // Get first matching file path for display
      const patterns = AGENT_PATTERNS[agentName] || [];
      const foundPath =
        patterns.find((p) => existsSync(join(cwd, p))) || patterns[0];

      newAgents.push({
        name: agentName,
        displayName: allDetected.displayNames.get(agentName) || agentName,
        filePath: foundPath || "",
      });
    }
  }

  return newAgents;
}

/**
 * Edit source configuration type
 */
export type EditSourceConfig = string | string[];

/**
 * Edit source recommendation with alternatives
 */
export interface EditSourceRecommendation {
  default: EditSourceConfig;
  alternatives: Array<{
    value: EditSourceConfig;
    label: string;
    description: string;
  }>;
}

/**
 * Recommend edit_source configuration based on detected agents
 * Priority: Cursor > AGENTS.md > other single-file > any_agent_file
 */
export function recommendEditSource(
  detectedAgents: string[],
): EditSourceRecommendation {
  // Priority 1: Cursor (most advanced/configurable)
  if (detectedAgents.includes("cursor")) {
    return {
      default: ".cursor/rules/*.mdc",
      alternatives: [
        {
          value: ".cursor/rules/*.mdc",
          label: "Cursor rules (Recommended)",
          description:
            "Full feature support: scopes, vendor metadata, frontmatter",
        },
        {
          value: "AGENTS.md",
          label: "AGENTS.md only",
          description: "Single markdown file, works with all AI assistants",
        },
        {
          value: ["AGENTS.md", ".cursor/rules/*.mdc"],
          label: "Both Cursor and AGENTS.md",
          description: "Edit in either place, changes sync automatically",
        },
        {
          value: "any_agent_file",
          label: "Any agent file",
          description: "Maximum flexibility, may cause section conflicts",
        },
        {
          value: ".rules.yaml",
          label: "Internal YAML only (Advanced/Complex)",
          description: "WARNING: Requires editing raw YAML, not recommended",
        },
      ],
    };
  }

  // Priority 2: AGENTS.md (universal standard)
  if (detectedAgents.includes("agents")) {
    return {
      default: "AGENTS.md",
      alternatives: [
        {
          value: "AGENTS.md",
          label: "AGENTS.md only (Recommended)",
          description: "Single markdown file, works with all AI assistants",
        },
        {
          value: "any_agent_file",
          label: "Any agent file",
          description: "Maximum flexibility, may cause section conflicts",
        },
        {
          value: ".rules.yaml",
          label: "Internal YAML only (Advanced/Complex)",
          description: "WARNING: Requires editing raw YAML, not recommended",
        },
      ],
    };
  }

  // Priority 3: Other single-file agents
  const singleFileAgents = detectedAgents.filter((a) =>
    ["claude", "crush", "warp", "gemini"].includes(a),
  );
  if (singleFileAgents.length > 0) {
    const firstAgent = singleFileAgents[0]!;
    const file =
      AGENT_PATTERNS[firstAgent]?.[0] || `${firstAgent.toUpperCase()}.md`;
    const displayName = AGENT_DISPLAY_NAMES[firstAgent] || firstAgent;

    return {
      default: file,
      alternatives: [
        {
          value: file,
          label: `${displayName} only (Recommended)`,
          description: `Single ${file} file for ${displayName}`,
        },
        {
          value: "any_agent_file",
          label: "Any agent file",
          description: "Maximum flexibility, may cause section conflicts",
        },
        {
          value: ".rules.yaml",
          label: "Internal YAML only (Advanced/Complex)",
          description: "WARNING: Requires editing raw YAML, not recommended",
        },
      ],
    };
  }

  // Priority 4: No agents detected - default to AGENTS.md
  return {
    default: "AGENTS.md",
    alternatives: [
      {
        value: "AGENTS.md",
        label: "AGENTS.md (Recommended)",
        description: "Single markdown file, works with all AI assistants",
      },
      {
        value: "any_agent_file",
        label: "Any agent file",
        description: "Maximum flexibility, may cause section conflicts",
      },
      {
        value: ".rules.yaml",
        label: "Internal YAML only (Advanced/Complex)",
        description: "WARNING: Requires editing raw YAML, not recommended",
      },
    ],
  };
}

/**
 * File format types
 */
export type FileFormat =
  | "agents"
  | "cursor-mdc"
  | "generic-markdown"
  | "unknown";

/**
 * Detected file with content information
 */
export interface DetectedFileWithContent {
  /** Absolute path to file */
  path: string;
  /** Relative path from cwd */
  relativePath: string;
  /** Agent/exporter name */
  agent: string;
  /** File format */
  format: FileFormat;
  /** Number of sections detected */
  sectionCount: number;
  /** Last modified time */
  lastModified: Date;
  /** File size in bytes */
  size: number;
  /** Whether file has any content */
  hasContent: boolean;
}

/**
 * Detection result with validation
 */
export interface DetectionResult {
  detected: string[];
  configured: string[];
  missing: string[]; // Detected but not configured
  notFound: string[]; // Configured but not detected
}

/**
 * Detect agents with validation against configured exporters
 *
 * @param cwd - Current working directory
 * @param configured - Configured exporters from config
 * @returns Detection result with validation
 */
export function detectAgentsWithValidation(
  cwd: string,
  configured: string[],
): DetectionResult {
  const result = detectAgents(cwd);
  const detected = result.detected;

  const missing = detected.filter((d) => !configured.includes(d));
  const notFound = configured.filter((c) => !detected.includes(c));

  return { detected, configured, missing, notFound };
}

/**
 * Check if detection results have changed since last cache
 *
 * @param current - Current detection result
 * @param cached - Cached detection result
 * @returns True if detection changed
 */
export function shouldWarnAboutDetection(
  current: DetectionResult,
  cached: { detected: string[]; configured: string[] } | null,
): boolean {
  if (!cached) return current.missing.length > 0 || current.notFound.length > 0;

  // Only warn if detection changed
  const detectedChanged =
    JSON.stringify([...current.detected].sort()) !==
    JSON.stringify([...cached.detected].sort());

  return (
    detectedChanged &&
    (current.missing.length > 0 || current.notFound.length > 0)
  );
}

/**
 * Determine file format from path and content
 */
function detectFileFormat(filePath: string, content: string): FileFormat {
  if (filePath.endsWith(".mdc")) {
    return "cursor-mdc";
  }
  if (filePath.includes("AGENTS.md")) {
    return "agents";
  }
  // Check for YAML frontmatter
  if (content.trimStart().startsWith("---")) {
    return "cursor-mdc";
  }
  // Generic markdown
  if (filePath.endsWith(".md")) {
    return "generic-markdown";
  }
  return "unknown";
}

/**
 * Count markdown sections (headings) in content
 */
function countSections(content: string): number {
  // Match markdown headings (## or ###)
  const headingRegex = /^#{1,6}\s+.+$/gm;
  const matches = content.match(headingRegex);
  return matches ? matches.length : 0;
}

/**
 * Detect files with content for a given agent
 * Scans directories and reads files to count sections
 */
export function detectFilesWithContent(
  cwd: string,
  agentName: string,
): DetectedFileWithContent[] {
  const patterns = AGENT_PATTERNS[agentName];
  if (!patterns) return [];

  const files: DetectedFileWithContent[] = [];

  for (const pattern of patterns) {
    const fullPath = join(cwd, pattern);

    try {
      const stats = statSync(fullPath);

      // Handle directories (e.g., .cursor/rules/)
      if (stats.isDirectory()) {
        try {
          const dirFiles = readdirSync(fullPath);
          for (const file of dirFiles) {
            // Skip non-markdown files
            if (!file.endsWith(".md") && !file.endsWith(".mdc")) continue;

            const filePath = join(fullPath, file);

            try {
              // Read file content directly - handle errors if file doesn't exist or changed
              const content = readFileSync(filePath, "utf-8");

              // Get file stats after reading to avoid race condition
              // If file changed during read, we still use the content we successfully read
              const now = new Date();
              let fileStats: ReturnType<typeof statSync> = {
                mtime: now,
                size: content.length,
                isFile: () => true,
              } as ReturnType<typeof statSync>;
              let shouldSkip = false;
              try {
                const stats = statSync(filePath);
                if (!stats.isFile()) {
                  // File changed to non-file after read, skip it
                  shouldSkip = true;
                } else {
                  fileStats = stats;
                }
              } catch {
                // Stat failed after read, but content was valid at read time
                // Use the default stats object we initialized above
              }
              if (shouldSkip) {
                continue;
              }

              const sectionCount = countSections(content);
              const hasContent = content.trim().length > 0 && sectionCount > 0;

              files.push({
                path: filePath,
                relativePath: join(pattern, file),
                agent: agentName,
                format: detectFileFormat(filePath, content),
                sectionCount,
                lastModified: fileStats!.mtime,
                size: Number(fileStats!.size),
                hasContent,
              });
            } catch {
              // Skip files we can't read or that disappear
              continue;
            }
          }
        } catch {
          // Skip directories we can't read
          continue;
        }
      }
      // Handle single files (e.g., AGENTS.md, CLAUDE.md)
      else {
        try {
          // Read file content directly - handle errors if file doesn't exist or changed
          const content = readFileSync(fullPath, "utf-8");

          // Get file stats after reading to avoid race condition
          // If file changed during read, we still use the content we successfully read
          const now = new Date();
          let fileStats: ReturnType<typeof statSync> = {
            mtime: now,
            size: content.length,
            isFile: () => true,
          } as ReturnType<typeof statSync>;
          let shouldSkip = false;
          try {
            const stats = statSync(fullPath);
            if (!stats.isFile()) {
              // File changed to non-file after read, skip it
              shouldSkip = true;
            } else {
              fileStats = stats;
            }
          } catch {
            // Stat failed after read, but content was valid at read time
            // Use the default stats object we initialized above
          }
          if (shouldSkip) {
            continue;
          }

          const sectionCount = countSections(content);
          const hasContent = content.trim().length > 0 && sectionCount > 0;

          files.push({
            path: fullPath,
            relativePath: pattern,
            agent: agentName,
            format: detectFileFormat(fullPath, content),
            sectionCount,
            lastModified: fileStats!.mtime,
            size: Number(fileStats!.size),
            hasContent,
          });
        } catch {
          // Skip files we can't read or that disappear
          continue;
        }
      }
    } catch {
      // Skip paths that don't exist or can't be accessed
      continue;
    }
  }

  return files;
}

/**
 * Detect all agent files with content in workspace
 * Returns map of agent name to files with content
 */
export function detectAllFilesWithContent(
  cwd: string = process.cwd(),
): Map<string, DetectedFileWithContent[]> {
  const result = new Map<string, DetectedFileWithContent[]>();

  for (const agentName of Object.keys(AGENT_PATTERNS)) {
    const files = detectFilesWithContent(cwd, agentName);
    if (files.length > 0) {
      // Only include files that have actual content
      const filesWithContent = files.filter((f) => f.hasContent);
      if (filesWithContent.length > 0) {
        result.set(agentName, filesWithContent);
      }
    }
  }

  return result;
}

/**
 * Detect untracked files (files with content not in edit_source)
 * @param cwd - Current working directory
 * @param editSource - Current edit_source configuration
 * @returns Array of untracked files with content
 */
export function detectUntrackedFiles(
  cwd: string,
  editSource: EditSourceConfig | undefined,
): DetectedFileWithContent[] {
  const allFiles = detectAllFilesWithContent(cwd);
  const untrackedFiles: DetectedFileWithContent[] = [];

  // Normalize edit_source to array
  const editSourcePatterns = editSource
    ? Array.isArray(editSource)
      ? editSource
      : [editSource]
    : [];

  // Helper to escape regex special characters
  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  };

  // Helper to check if a file path matches edit_source patterns
  const isTracked = (relativePath: string): boolean => {
    for (const pattern of editSourcePatterns) {
      // Handle glob patterns
      if (pattern.includes("*")) {
        // Validate pattern length to prevent ReDoS
        if (pattern.length > 200) {
          console.warn(
            `Edit source pattern exceeds maximum length (200 chars), skipping: ${pattern.slice(0, 50)}...`,
          );
          continue;
        }
        // Escape everything first, then replace \* with .*
        const escaped = escapeRegex(pattern);
        const regexPattern = escaped.replace(/\\\*/g, ".*");

        // Safe: Pattern length validated (max 200), escaped, and only contains .* wildcards
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(relativePath)) {
          return true;
        }
      }
      // Handle exact matches
      else if (relativePath === pattern) {
        return true;
      }
      // Handle directory patterns (e.g., ".cursor/rules/*.mdc")
      else if (pattern.endsWith("/*") || pattern.endsWith("/**")) {
        const dir = pattern.replace(/\/\*+$/, "");
        if (relativePath.startsWith(dir + "/")) {
          return true;
        }
      }
    }
    return false;
  };

  // Find untracked files
  for (const [, files] of allFiles) {
    for (const file of files) {
      if (!isTracked(file.relativePath)) {
        untrackedFiles.push(file);
      }
    }
  }

  return untrackedFiles;
}
