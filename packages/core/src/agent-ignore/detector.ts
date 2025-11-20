/**
 * Conflict detection for agent ignore management
 * Detects when multiple exporters target formats consumable by same agent
 */

import {
  getAgentIgnoreSpec,
  needsIgnoreWarning,
  getConsumableExporters,
  AGENTS_WITHOUT_IGNORE,
  CONFIG_BASED_IGNORE,
} from "./registry.js";

export interface AgentConflict {
  /** Agent that can consume multiple formats */
  agent: string;
  /** Exporters that create consumable formats */
  conflictingExporters: string[];
  /** Native format to prioritize */
  nativeFormat: string;
  /** Formats to ignore */
  formatsToIgnore: string[];
  /** Ignore file to use */
  ignoreFile: string;
  /** Whether agent supports nested ignore files */
  supportsNested: boolean;
  /** Additional indexing ignore file (optional) */
  indexingIgnoreFile?: string | undefined;
}

export interface AgentWarning {
  /** Agent without ignore support */
  agent: string;
  /** Exporters creating duplicate content */
  conflictingExporters: string[];
  /** Reason for warning */
  reason: string;
}

export interface ConflictDetectionResult {
  /** Conflicts that can be resolved with ignore files */
  conflicts: AgentConflict[];
  /** Warnings for agents without ignore support */
  warnings: AgentWarning[];
  /** Whether any conflicts or warnings were found */
  hasIssues: boolean;
}

/**
 * Detect conflicts between enabled exporters
 * @param enabledExporters - List of enabled exporter names
 * @param customPriority - Optional custom format priority overrides
 * @returns Detection result with conflicts and warnings
 */
export function detectConflicts(
  enabledExporters: string[],
  customPriority?: Record<string, string>,
): ConflictDetectionResult {
  const conflicts: AgentConflict[] = [];
  const warnings: AgentWarning[] = [];

  // Get all unique agents from enabled exporters
  const agents = new Set<string>();
  enabledExporters.forEach((exp) => {
    agents.add(exp);
  });

  // Check each agent for conflicts
  for (const agent of agents) {
    const spec = getAgentIgnoreSpec(agent);

    if (spec) {
      // Agent has ignore support - check for conflicts
      const consumableExporters = getConsumableExporters(
        agent,
        enabledExporters,
      );

      if (consumableExporters.length > 1) {
        // Conflict detected - multiple formats consumable by this agent
        const priorityFormat = customPriority?.[agent] || spec.nativeFormat;
        const formatsToIgnore = consumableExporters.filter(
          (exp) => exp !== priorityFormat,
        );

        const conflict: AgentConflict = {
          agent,
          conflictingExporters: consumableExporters,
          nativeFormat: priorityFormat,
          formatsToIgnore,
          ignoreFile: spec.ignoreFile,
          supportsNested: spec.supportsNested,
        };

        if (spec.indexingIgnoreFile) {
          conflict.indexingIgnoreFile = spec.indexingIgnoreFile;
        }

        conflicts.push(conflict);
      }
    } else if (needsIgnoreWarning(agent, enabledExporters)) {
      // Agent without ignore support has potential conflicts
      const consumableExporters = enabledExporters.filter(
        (exp) => exp === "agents" || exp === agent,
      );

      if (consumableExporters.length > 1) {
        let reason = "No known ignore mechanism";
        if (AGENTS_WITHOUT_IGNORE.includes(agent)) {
          reason = "Uses .gitignore only, no dedicated ignore file";
        } else if (CONFIG_BASED_IGNORE[agent]) {
          reason = `Uses ${CONFIG_BASED_IGNORE[agent]} for ignore patterns`;
        }

        warnings.push({
          agent,
          conflictingExporters: consumableExporters,
          reason,
        });
      }
    }
  }

  return {
    conflicts,
    warnings,
    hasIssues: conflicts.length > 0 || warnings.length > 0,
  };
}

/**
 * Get file patterns to ignore for a specific conflict
 * @param conflict - Agent conflict
 * @returns Array of file patterns to add to ignore file
 */
export function getIgnorePatterns(conflict: AgentConflict): string[] {
  const patterns: string[] = [];

  for (const format of conflict.formatsToIgnore) {
    // Map exporter names to file patterns
    switch (format) {
      case "agents":
        patterns.push("AGENTS.md");
        break;
      case "cursor":
        patterns.push(".cursor/rules/*.mdc");
        break;
      case "claude":
        patterns.push("CLAUDE.md");
        break;
      case "warp":
        patterns.push("WARP.md");
        break;
      case "gemini":
        patterns.push("GEMINI.md");
        break;
      case "crush":
        patterns.push("CRUSH.md");
        break;
      case "aider":
        patterns.push(".aider.conf.yml");
        break;
      case "cline":
        patterns.push(".clinerules");
        break;
      case "goose":
        patterns.push(".goosehints");
        break;
      case "amazonq":
        patterns.push(".amazonq/rules/*.md");
        break;
      case "augmentcode":
        patterns.push(".augment/rules/*.md");
        break;
      case "kilocode":
        patterns.push(".kilocode/rules/*.md");
        break;
      case "kiro":
        patterns.push(".kiro/steering/*.md");
        break;
      case "firebase-studio":
        patterns.push(".idx/airules.md");
        break;
      case "junie":
        patterns.push(".junie/guidelines.md");
        break;
      case "trae-ai":
        patterns.push(".trae/rules/project_rules.md");
        break;
      case "openhands":
        patterns.push(".openhands/microagents/repo.md");
        break;
      case "firebender":
        patterns.push("firebender.json");
        break;
      // MCP exporters don't create rule files, skip
      case "cursor-mcp":
      case "vscode-mcp":
      case "amazonq-mcp":
      case "kilocode-mcp":
      case "roocode-mcp":
      case "windsurf-mcp":
      case "firebase-mcp":
      case "root-mcp":
        break;
      default:
        // For unknown formats, try to infer pattern
        if (format.endsWith("-config")) {
          // Config exporters typically don't create rule files
          break;
        }
        // Default to uppercase markdown file
        patterns.push(`${format.toUpperCase()}.md`);
    }
  }

  return patterns;
}

/**
 * Get nested ignore patterns for scoped exports
 * @param conflict - Agent conflict
 * @param _scopePath - Scope path (e.g., "apps/web")
 * @returns Array of relative file patterns for nested ignore file
 */
export function getNestedIgnorePatterns(
  conflict: AgentConflict,
  _scopePath: string,
): string[] {
  const patterns: string[] = [];

  for (const format of conflict.formatsToIgnore) {
    // For nested scopes, use relative paths
    switch (format) {
      case "agents":
        patterns.push("AGENTS.md");
        break;
      case "cursor":
        patterns.push(".cursor/rules/*.mdc");
        break;
      case "claude":
        patterns.push("CLAUDE.md");
        break;
      case "warp":
        patterns.push("WARP.md");
        break;
      // Other formats typically don't support nested scopes
      default:
        break;
    }
  }

  return patterns;
}

/**
 * Format conflict message for user display
 */
export function formatConflictMessage(conflict: AgentConflict): string {
  const agentName =
    conflict.agent.charAt(0).toUpperCase() + conflict.agent.slice(1);
  const formats = conflict.conflictingExporters.join(", ");
  const ignored = conflict.formatsToIgnore.join(", ");

  return `${agentName} can read multiple formats (${formats}). To prevent duplicate context, add ${ignored} to ${conflict.ignoreFile}?`;
}

/**
 * Format warning message for user display
 */
export function formatWarningMessage(warning: AgentWarning): string {
  const agentName =
    warning.agent.charAt(0).toUpperCase() + warning.agent.slice(1);
  const formats = warning.conflictingExporters.join(", ");

  return `${agentName} can read multiple formats (${formats}) but has no known ignore mechanism. ${warning.reason}. Consider disabling one exporter.`;
}
