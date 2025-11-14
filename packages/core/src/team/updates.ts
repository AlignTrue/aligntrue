/**
 * Update detection for team mode (DEPRECATED - removed allow list)
 * Updates now detected via git diff and PR review
 */

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
 * Detect updates for a given config (DEPRECATED - removed allow list)
 * Updates now detected via git diff and PR review
 * High-level API for CLI usage
 */
export function detectUpdatesForConfig(
  _config: unknown,
): Promise<UpdateResult> {
  // DEPRECATED: Update detection now happens via git diff
  // Return empty result
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
