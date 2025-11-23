import { isMultiFileFormat } from "./detection-output-formatter.js";

/**
 * Edit source configuration type
 */
export type EditSourceConfig = string | string[];

/**
 * Check if current edit source is multi-file
 */
export function isMultiFileEditSource(
  editSource: EditSourceConfig | undefined,
): boolean {
  if (!editSource) return false;

  const sources = Array.isArray(editSource) ? editSource : [editSource];

  // Check if any of the sources look like multi-file patterns
  // Multi-file patterns typically contain wildcards or point to directories
  return sources.some((src) => {
    return (
      src.includes("*") ||
      src.includes(".cursor/rules") ||
      src.includes(".amazonq/rules") ||
      src.includes(".augment/rules") ||
      src.includes(".kilocode/rules") ||
      src.includes(".kiro/steering")
    );
  });
}

/**
 * Categorized agents
 */
export interface CategorizedAgents {
  upgradeCandidates: string[];
  exportTargets: string[];
}

/**
 * Categorize detected agents into upgrade candidates vs export targets
 */
export function categorizeDetectedAgents(
  agents: string[],
  currentEditSource: EditSourceConfig | undefined,
): CategorizedAgents {
  const isCurrentMultiFile = isMultiFileEditSource(currentEditSource);

  const upgradeCandidates: string[] = [];
  const exportTargets: string[] = [];

  for (const agent of agents) {
    // If current source is already multi-file, EVERYTHING is just an export target
    // We never "upgrade" from one multi-file source to another automatically
    if (isCurrentMultiFile) {
      exportTargets.push(agent);
      continue;
    }

    // If current is single-file (or empty), only multi-file agents are upgrade candidates
    if (isMultiFileFormat(agent)) {
      upgradeCandidates.push(agent);
    } else {
      exportTargets.push(agent);
    }
  }

  return {
    upgradeCandidates,
    exportTargets,
  };
}
