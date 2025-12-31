/**
 * Drift detection for team mode (v2 - simplified)
 *
 * Detects:
 * - Lockfile drift - whether rules or config have changed since lockfile was generated
 * - Merge conflicts - unresolved git conflicts in lockfile or rule files
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import type { Lockfile } from "../lockfile/types.js";
import { generateLockfile } from "../lockfile/generator.js";
import { loadRulesDirectory } from "../rules/file-io.js";
import { isPlainObject } from "../overlays/operations.js";

/**
 * Drift category - lockfile or conflict
 */
export type DriftCategory = "lockfile" | "conflict";

/**
 * Individual drift finding
 */
export interface DriftFinding {
  category: DriftCategory;
  rule_id: string;
  message: string;
  suggestion: string;
  lockfile_hash?: string;
  expected_hash?: string;
}

/**
 * Drift detection result
 */
export interface DriftResult {
  has_drift: boolean;
  findings: DriftFinding[];
  summary: {
    total: number;
    by_category: {
      lockfile: number;
      conflict: number;
    };
  };
}

/**
 * Check if a file contains git merge conflict markers
 */
function hasConflictMarkers(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    // Check for standard git conflict markers
    return (
      content.includes("<<<<<<<") &&
      content.includes("=======") &&
      content.includes(">>>>>>>")
    );
  } catch {
    return false;
  }
}

/**
 * Get list of files with unresolved git merge conflicts in a directory
 * Uses git status to detect unmerged files (UU status)
 */
function getGitConflictFiles(basePath: string): string[] {
  try {
    // Check if we're in a git repo
    execFileSync("git", ["rev-parse", "--git-dir"], {
      cwd: basePath,
      stdio: "pipe",
      timeout: 2000, // 2 second timeout for rev-parse
    });

    // Get unmerged files from git status
    const output = execFileSync("git", ["status", "--porcelain"], {
      cwd: basePath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000, // 5 second timeout for git status
    });

    // Parse status output for unmerged files (UU, AA, DD, AU, UA, DU, UD)
    const conflictFiles: string[] = [];
    for (const line of output.split("\n")) {
      if (line.length < 3) continue;
      const status = line.substring(0, 2);
      // UU = both modified, AA = both added, DD = both deleted
      // AU/UA = added by us/them, DU/UD = deleted by us/them
      if (
        status === "UU" ||
        status === "AA" ||
        status === "DD" ||
        status === "AU" ||
        status === "UA" ||
        status === "DU" ||
        status === "UD"
      ) {
        const file = line.substring(3).trim();
        // Only track .aligntrue files
        if (file.startsWith(".aligntrue/")) {
          conflictFiles.push(file);
        }
      }
    }

    return conflictFiles;
  } catch {
    // Not a git repo or git command failed
    return [];
  }
}

/**
 * Scan directory for files containing conflict markers
 */
function scanForConflictMarkers(dirPath: string): string[] {
  const conflictFiles: string[] = [];

  if (!existsSync(dirPath)) {
    return conflictFiles;
  }

  const scanDir = (dir: string, basePath: string) => {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = join(basePath, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories except .aligntrue
          if (!entry.name.startsWith(".") || entry.name === ".aligntrue") {
            scanDir(fullPath, relativePath);
          }
        } else if (
          entry.name.endsWith(".md") ||
          entry.name.endsWith(".json") ||
          entry.name.endsWith(".yaml")
        ) {
          if (hasConflictMarkers(fullPath)) {
            conflictFiles.push(relativePath);
          }
        }
      }
    } catch {
      // Directory read failed
    }
  };

  scanDir(dirPath, "");
  return conflictFiles;
}

/**
 * Detect merge conflicts in .aligntrue directory
 */
function detectMergeConflicts(basePath: string): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const aligntruePath = join(basePath, ".aligntrue");

  // Method 1: Check git status for unmerged files
  const gitConflicts = getGitConflictFiles(basePath);

  // Method 2: Scan for conflict markers in files
  const markerConflicts = scanForConflictMarkers(aligntruePath);

  // Combine and deduplicate
  const allConflicts = [
    ...new Set([
      ...gitConflicts,
      ...markerConflicts.map((f) => `.aligntrue/${f}`),
    ]),
  ];

  if (allConflicts.length > 0) {
    findings.push({
      category: "conflict",
      rule_id: "_merge_conflict",
      message: `Unresolved merge conflicts in: ${allConflicts.join(", ")}`,
      suggestion:
        "Resolve merge conflicts manually, then run: git add <files> && aligntrue sync",
    });
  }

  return findings;
}

/**
 * Detect lockfile drift
 * Compares current bundle hash (computed from rules + config) with lockfile bundle hash
 */
export function detectLockfileDrift(
  lockfile: Lockfile,
  currentBundleHash: string,
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  // Compare lockfile bundle hash with current bundle hash
  if (lockfile.bundle_hash !== currentBundleHash) {
    findings.push({
      category: "lockfile",
      rule_id: "_bundle",
      message:
        "Rules or team config have changed since last lockfile generation",
      suggestion: "Run: aligntrue sync (to regenerate lockfile)",
      lockfile_hash: lockfile.bundle_hash,
      expected_hash: currentBundleHash,
    });
  }

  return findings;
}

/**
 * High-level drift detection for CLI usage
 * Takes config object and handles file paths internally
 */
export async function detectDriftForConfig(
  config: unknown,
  _ignoreLockfileDrift: boolean = false,
): Promise<{
  driftDetected: boolean;
  mode: string;
  lockfilePath: string;
  summary?: string | undefined;
  drift: Array<{
    category: DriftCategory;
    ruleId: string;
    description: string;
    suggestion?: string | undefined;
    lockfile_hash?: string;
    expected_hash?: string;
  }>;
}> {
  const configRecord = isPlainObject(config) ? config : {};
  const basePath =
    typeof configRecord["rootDir"] === "string" ? configRecord["rootDir"] : ".";
  const lockfilePath =
    typeof configRecord["lockfilePath"] === "string"
      ? configRecord["lockfilePath"]
      : ".aligntrue/lock.json";

  try {
    const result = await detectDrift(
      lockfilePath,
      basePath,
      _ignoreLockfileDrift,
    );

    return {
      driftDetected: result.has_drift,
      mode: "team",
      lockfilePath,
      summary: result.has_drift
        ? `${result.summary.total} drift finding(s)`
        : "",
      drift: result.findings.map((f: DriftFinding) => {
        const entry: {
          category: DriftCategory;
          ruleId: string;
          description: string;
          suggestion?: string;
          lockfile_hash?: string;
          expected_hash?: string;
        } = {
          category: f.category,
          ruleId: f.rule_id,
          description: f.message,
        };
        if (f.suggestion) entry.suggestion = f.suggestion;
        if (f.lockfile_hash) entry.lockfile_hash = f.lockfile_hash;
        if (f.expected_hash) entry.expected_hash = f.expected_hash;
        return entry;
      }),
    };
  } catch {
    // If files don't exist, no drift
    return {
      driftDetected: false,
      mode: "team",
      lockfilePath,
      drift: [],
    };
  }
}

/**
 * Main drift detection
 * Checks for merge conflicts and lockfile drift
 */
export async function detectDrift(
  lockfilePath: string,
  basePath: string = ".",
  ignoreLockfileDrift: boolean = false,
): Promise<DriftResult> {
  const emptyResult: DriftResult = {
    has_drift: false,
    findings: [],
    summary: {
      total: 0,
      by_category: {
        lockfile: 0,
        conflict: 0,
      },
    },
  };

  // First, check for merge conflicts (always checked, even if ignoring lockfile drift)
  const conflictFindings = detectMergeConflicts(basePath);

  // Check if lockfile exists
  if (!existsSync(lockfilePath)) {
    // Return conflict findings if any, otherwise empty
    if (conflictFindings.length > 0) {
      return {
        has_drift: true,
        findings: conflictFindings,
        summary: {
          total: conflictFindings.length,
          by_category: {
            lockfile: 0,
            conflict: conflictFindings.length,
          },
        },
      };
    }
    return emptyResult;
  }

  // Parse lockfile
  let lockfile: Lockfile;
  try {
    const lockfileContent = readFileSync(lockfilePath, "utf-8");
    lockfile = JSON.parse(lockfileContent) as Lockfile;
  } catch (_err) {
    // If lockfile has conflict markers, report that instead of parse error
    if (hasConflictMarkers(lockfilePath)) {
      const conflictFinding: DriftFinding = {
        category: "conflict",
        rule_id: "_merge_conflict",
        message: "Lockfile contains unresolved merge conflict markers",
        suggestion:
          "Resolve merge conflicts in .aligntrue/lock.json, then run: aligntrue sync",
      };
      return {
        has_drift: true,
        findings: [conflictFinding, ...conflictFindings],
        summary: {
          total: 1 + conflictFindings.length,
          by_category: {
            lockfile: 0,
            conflict: 1 + conflictFindings.length,
          },
        },
      };
    }
    throw new Error(
      `Failed to parse lockfile: ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }

  // Collect all findings
  const allFindings: DriftFinding[] = [...conflictFindings];

  // If not ignoring lockfile drift, check hash
  if (!ignoreLockfileDrift) {
    // Load current rules and compute bundle hash
    const rulesPath = join(basePath, ".aligntrue/rules");
    if (existsSync(rulesPath)) {
      try {
        const rules = await loadRulesDirectory(rulesPath, basePath);
        const currentLockfile = generateLockfile(rules, basePath);
        const lockfileFindings = detectLockfileDrift(
          lockfile,
          currentLockfile.bundle_hash,
        );
        allFindings.push(...lockfileFindings);
      } catch {
        // Can't compute current hash, skip lockfile drift check
      }
    }
  }

  // Count findings by category
  const lockfileCount = allFindings.filter(
    (f) => f.category === "lockfile",
  ).length;
  const conflictCount = allFindings.filter(
    (f) => f.category === "conflict",
  ).length;

  return {
    has_drift: allFindings.length > 0,
    findings: allFindings,
    summary: {
      total: allFindings.length,
      by_category: {
        lockfile: lockfileCount,
        conflict: conflictCount,
      },
    },
  };
}
