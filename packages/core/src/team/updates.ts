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
 * Detect upstream updates (DEPRECATED - removed allow list)
 * Uses base_hash when available for overlay-aware detection
 */
/* DEPRECATED: Removed allow list mechanism
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
    // Overlays system: Use base_hash if available (more precise for overlays)
    const firstEntry = entries[0];
    if (!firstEntry) continue; // TypeScript guard

    const currentHash = firstEntry.base_hash || firstEntry.content_hash;
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
*/

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

  /* OLD IMPLEMENTATION - removed allow list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configAsAny = config as any;
  const lockfilePath = configAsAny.lockfilePath || ".aligntrue.lock.json";
  const allowListPath = configAsAny.allowListPath || ".aligntrue/allow.yaml";

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
  } catch {
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
  */
}
