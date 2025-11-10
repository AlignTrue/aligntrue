/**
 * Diff calculator for rule changes
 * Compares before/after rule sets to show what changed during auto-pull
 */

import type { AlignSection } from "@aligntrue/schema";

export interface RuleChange {
  rule: AlignSection;
  changes: string[];
}

export interface RuleDiff {
  added: AlignSection[];
  modified: RuleChange[];
  removed: AlignSection[];
}

/**
 * Calculate difference between two rule sets
 * Returns added, modified, and removed rules with change details
 */
export function calculateRuleDiff(
  before: AlignSection[],
  after: AlignSection[],
): RuleDiff {
  const diff: RuleDiff = {
    added: [],
    modified: [],
    removed: [],
  };

  // Create maps for efficient lookup
  const beforeMap = new Map<string, AlignSection>();
  const afterMap = new Map<string, AlignSection>();

  for (const rule of before) {
    beforeMap.set(rule.id, rule);
  }

  for (const rule of after) {
    afterMap.set(rule.id, rule);
  }

  // Find added and modified rules
  for (const rule of after) {
    const beforeRule = beforeMap.get(rule.id);

    if (!beforeRule) {
      // Rule added
      diff.added.push(rule);
    } else {
      // Check if modified
      const changes = compareRules(beforeRule, rule);
      if (changes.length > 0) {
        diff.modified.push({
          rule,
          changes,
        });
      }
    }
  }

  // Find removed rules
  for (const rule of before) {
    if (!afterMap.has(rule.id)) {
      diff.removed.push(rule);
    }
  }

  // Sort for deterministic output
  diff.added.sort((a, b) => a.id.localeCompare(b.id));
  diff.modified.sort((a, b) => a.rule.id.localeCompare(b.rule.id));
  diff.removed.sort((a, b) => a.id.localeCompare(b.id));

  return diff;
}

/**
 * Compare two rules and return list of changes
 */
function compareRules(before: AlignSection, after: AlignSection): string[] {
  const changes: string[] = [];

  // Compare severity
  if (before.severity !== after.severity) {
    changes.push(`severity: ${before.severity} → ${after.severity}`);
  }

  // Compare guidance (content)
  if (before.guidance !== after.guidance) {
    const beforeLength = before.guidance?.length || 0;
    const afterLength = after.guidance?.length || 0;

    if (!before.guidance && after.guidance) {
      changes.push(`guidance: added (${afterLength} chars)`);
    } else if (before.guidance && !after.guidance) {
      changes.push(`guidance: removed (was ${beforeLength} chars)`);
    } else {
      changes.push(
        `guidance: modified (${beforeLength} → ${afterLength} chars)`,
      );
    }
  }

  // Compare mode (if present)
  const beforeMode = (before as AlignSection).mode;
  const afterMode = (after as AlignSection).mode;

  if (beforeMode !== afterMode) {
    if (!beforeMode && afterMode) {
      changes.push(`mode: added (${afterMode})`);
    } else if (beforeMode && !afterMode) {
      changes.push(`mode: removed (was ${beforeMode})`);
    } else {
      changes.push(`mode: ${beforeMode} → ${afterMode}`);
    }
  }

  // Compare tags
  const beforeTags = before.tags || [];
  const afterTags = after.tags || [];

  if (JSON.stringify(beforeTags) !== JSON.stringify(afterTags)) {
    const addedTags = afterTags.filter((t) => !beforeTags.includes(t));
    const removedTags = beforeTags.filter((t) => !afterTags.includes(t));

    if (addedTags.length > 0) {
      changes.push(`tags: added ${addedTags.join(", ")}`);
    }
    if (removedTags.length > 0) {
      changes.push(`tags: removed ${removedTags.join(", ")}`);
    }
  }

  // Compare applies_to (scoping rules)
  const beforeAppliesTo = before.applies_to || [];
  const afterAppliesTo = after.applies_to || [];

  if (JSON.stringify(beforeAppliesTo) !== JSON.stringify(afterAppliesTo)) {
    changes.push(
      `applies_to: ${beforeAppliesTo.length} → ${afterAppliesTo.length} entries`,
    );
  }

  return changes;
}

/**
 * Format diff summary for brief output
 * Returns array of lines to display
 */
export function formatDiffSummary(diff: RuleDiff): string[] {
  const lines: string[] = [];
  const totalChanges =
    diff.added.length + diff.modified.length + diff.removed.length;

  if (totalChanges === 0) {
    lines.push("No changes");
    return lines;
  }

  lines.push(`${totalChanges} change${totalChanges !== 1 ? "s" : ""}:`);

  // Show added rules
  for (const rule of diff.added.slice(0, 3)) {
    lines.push(`  + Added: ${rule.id}`);
  }
  if (diff.added.length > 3) {
    lines.push(`  + ... and ${diff.added.length - 3} more`);
  }

  // Show modified rules
  for (const { rule, changes } of diff.modified.slice(0, 3)) {
    const changesSummary = changes[0] || "modified";
    lines.push(`  ~ Modified: ${rule.id} (${changesSummary})`);
  }
  if (diff.modified.length > 3) {
    lines.push(`  ~ ... and ${diff.modified.length - 3} more`);
  }

  // Show removed rules
  for (const rule of diff.removed.slice(0, 3)) {
    lines.push(`  - Removed: ${rule.id}`);
  }
  if (diff.removed.length > 3) {
    lines.push(`  - ... and ${diff.removed.length - 3} more`);
  }

  return lines;
}

/**
 * Format full diff with all details
 */
export function formatFullDiff(diff: RuleDiff): string[] {
  const lines: string[] = [];

  if (diff.added.length > 0) {
    lines.push("");
    lines.push("Added rules:");
    for (const rule of diff.added) {
      lines.push(`  + ${rule.id}`);
      if (rule.severity) {
        lines.push(`      Severity: ${rule.severity}`);
      }
      if (rule.guidance) {
        const preview =
          rule.guidance.length > 60
            ? rule.guidance.slice(0, 60) + "..."
            : rule.guidance;
        lines.push(`      Guidance: ${preview}`);
      }
    }
  }

  if (diff.modified.length > 0) {
    lines.push("");
    lines.push("Modified rules:");
    for (const { rule, changes } of diff.modified) {
      lines.push(`  ~ ${rule.id}`);
      for (const change of changes) {
        lines.push(`      ${change}`);
      }
    }
  }

  if (diff.removed.length > 0) {
    lines.push("");
    lines.push("Removed rules:");
    for (const rule of diff.removed) {
      lines.push(`  - ${rule.id}`);
    }
  }

  return lines;
}
