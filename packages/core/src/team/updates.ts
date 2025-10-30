/**
 * Update detection for team mode
 * Detects available updates from allowed sources
 */

import { existsSync, readFileSync } from "fs";
import { parseAllowList } from "./allow.js";
import type { AllowList, AllowListSource } from "./types.js";
import type { Lockfile, LockfileEntry } from "../lockfile/types.js";

// TODO (Phase 4): Add catalog source support
// When catalog is available, resolve id@version to latest catalog entry
// and compare to lockfile entry. Git resolution pattern can be reused.

/**
 * Individual update finding
 */
export interface UpdateFinding {
  source: string;
  current_sha: string;
  latest_sha: string;
  affected_rules: string[];
  breaking_change: boolean; // Future: detect from version tags
}

/**
 * Update detection result
 */
export interface UpdateResult {
  has_updates: boolean;
  updates: UpdateFinding[];
  summary: {
    total: number;
    sources_updated: number;
    rules_affected: number;
    breaking_changes: number;
  };
}

/**
 * Detect upstream updates by comparing lockfile to allowed sources
 * Git-only for Phase 3; catalog support deferred to Phase 4
 */
export function detectUpstreamUpdates(
  lockfile: Lockfile,
  allowList: AllowList,
): UpdateFinding[] {
  const updates: UpdateFinding[] = [];

  // Group lockfile entries by source
  const bySource = new Map<string, LockfileEntry[]>();
  for (const entry of lockfile.rules) {
    if (!entry.source) continue;

    const existing = bySource.get(entry.source) || [];
    existing.push(entry);
    bySource.set(entry.source, existing);
  }

  // Check each source for updates
  for (const [source, entries] of bySource) {
    if (entries.length === 0) continue;

    const allowedSource = allowList.sources.find(
      (s: AllowListSource) =>
        s.value === source ||
        s.value.includes(source) ||
        source.includes(s.value),
    );

    if (!allowedSource || !allowedSource.resolved_hash) {
      // Source not in allow list or no resolved hash
      continue;
    }

    // Compare current hash to allowed hash
    const firstEntry = entries[0];
    if (!firstEntry) continue; // TypeScript guard

    const currentHash = firstEntry.content_hash; // All entries from same source should have same hash
    if (currentHash !== allowedSource.resolved_hash) {
      updates.push({
        source,
        current_sha: currentHash,
        latest_sha: allowedSource.resolved_hash,
        affected_rules: entries.map((e) => e.rule_id),
        breaking_change: false, // Future: detect from version tags
      });
    }
  }

  return updates;
}

/**
 * Generate human-readable summary of updates
 */
export function generateUpdateSummary(updates: UpdateFinding[]): string {
  if (updates.length === 0) {
    return "No updates available";
  }

  const totalRules = updates.reduce(
    (sum, u) => sum + u.affected_rules.length,
    0,
  );
  const breakingChanges = updates.filter((u) => u.breaking_change).length;

  let summary = `${updates.length} source${updates.length === 1 ? "" : "s"} updated, ${totalRules} rule${totalRules === 1 ? "" : "s"} affected`;

  if (breakingChanges > 0) {
    summary += `, ${breakingChanges} breaking change${breakingChanges === 1 ? "" : "s"}`;
  }

  return summary;
}

/**
 * Detect updates for a given config
 * High-level API for CLI usage
 */
export function detectUpdatesForConfig(config: any): Promise<UpdateResult> {
  const lockfilePath = config.lockfilePath || ".aligntrue.lock.json";
  const allowListPath = config.allowListPath || ".aligntrue/allow.yaml";

  try {
    // Check if files exist
    if (!existsSync(lockfilePath) || !existsSync(allowListPath)) {
      return Promise.resolve({
        has_updates: false,
        updates: [],
        summary: {
          total: 0,
          sources_updated: 0,
          rules_affected: 0,
          breaking_changes: 0,
        },
      });
    }

    // Parse lockfile
    const lockfileContent = readFileSync(lockfilePath, "utf-8");
    const lockfile = JSON.parse(lockfileContent) as Lockfile;

    // Parse allow list
    const allowList = parseAllowList(allowListPath);

    // Detect updates
    const updates = detectUpstreamUpdates(lockfile, allowList);

    // Calculate summary
    const totalRules = updates.reduce(
      (sum, u) => sum + u.affected_rules.length,
      0,
    );
    const breakingChanges = updates.filter((u) => u.breaking_change).length;

    return Promise.resolve({
      has_updates: updates.length > 0,
      updates,
      summary: {
        total: updates.length,
        sources_updated: updates.length,
        rules_affected: totalRules,
        breaking_changes: breakingChanges,
      },
    });
  } catch (error) {
    // If parsing fails, return no updates
    return Promise.resolve({
      has_updates: false,
      updates: [],
      summary: {
        total: 0,
        sources_updated: 0,
        rules_affected: 0,
        breaking_changes: 0,
      },
    });
  }
}
