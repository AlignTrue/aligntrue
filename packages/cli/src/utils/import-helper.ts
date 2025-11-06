/**
 * Multi-agent import and merge helper
 */

import type { AlignRule } from "@aligntrue/schema";
import { importFromAgent } from "@aligntrue/core";

/**
 * Duplicate rule information
 */
export interface DuplicateInfo {
  /** Original rule ID */
  originalId: string;
  /** Renamed ID with suffix */
  renamedId: string;
  /** Agents where this rule was found */
  agents: string[];
}

/**
 * Import statistics
 */
export interface ImportStats {
  /** Total rules after merge */
  totalRules: number;
  /** Unique rules (no duplicates) */
  uniqueRules: number;
  /** Number of duplicates found */
  duplicateCount: number;
}

/**
 * Result of multi-agent import
 */
export interface MultiAgentImportResult {
  /** Merged rules */
  rules: AlignRule[];
  /** Duplicate rules that were renamed */
  duplicates: DuplicateInfo[];
  /** Import statistics */
  stats: ImportStats;
}

/**
 * Import and merge rules from multiple agents
 *
 * @param agents - List of agents to import from
 * @param workspaceRoot - Workspace root directory
 * @returns Merged rules with duplicate handling
 */
export async function importAndMergeFromMultipleAgents(
  agents: Array<{ agent: string; files: string[] }>,
  workspaceRoot: string,
): Promise<MultiAgentImportResult> {
  const allRules = new Map<string, AlignRule>();
  const duplicates: DuplicateInfo[] = [];

  for (const { agent } of agents) {
    try {
      const rules = await importFromAgent(agent, workspaceRoot);

      for (const rule of rules) {
        if (allRules.has(rule.id)) {
          // Duplicate found - rename with suffix
          let suffix = 1;
          let newId = `${rule.id}.duplicate-${suffix}`;

          while (allRules.has(newId)) {
            suffix++;
            newId = `${rule.id}.duplicate-${suffix}`;
          }

          duplicates.push({
            originalId: rule.id,
            renamedId: newId,
            agents: [agent, "previous"],
          });

          rule.id = newId;
        }

        allRules.set(rule.id, rule);
      }
    } catch (err) {
      // Log error but continue with other agents
      console.warn(
        `Warning: Failed to import from ${agent}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    rules: Array.from(allRules.values()),
    duplicates,
    stats: {
      totalRules: allRules.size,
      uniqueRules: allRules.size - duplicates.length,
      duplicateCount: duplicates.length,
    },
  };
}
