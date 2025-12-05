/**
 * Drift detection for team mode (v2 - simplified)
 *
 * Only detects lockfile drift - whether rules or config have changed
 * since the lockfile was generated.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Lockfile } from "../lockfile/types.js";
import { generateLockfile } from "../lockfile/generator.js";
import { loadRulesDirectory } from "../rules/file-io.js";
import { isPlainObject } from "../overlays/operations.js";

/**
 * Drift category - now just lockfile
 */
export type DriftCategory = "lockfile";

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
    };
  };
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
 * Just checks lockfile drift
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
      },
    },
  };

  // Check if lockfile exists
  if (!existsSync(lockfilePath)) {
    return emptyResult;
  }

  // Parse lockfile
  let lockfile: Lockfile;
  try {
    const lockfileContent = readFileSync(lockfilePath, "utf-8");
    lockfile = JSON.parse(lockfileContent) as Lockfile;
  } catch (_err) {
    throw new Error(
      `Failed to parse lockfile: ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }

  // If ignoring lockfile drift, return empty
  if (ignoreLockfileDrift) {
    return emptyResult;
  }

  // Load current rules and compute bundle hash
  const rulesPath = join(basePath, ".aligntrue/rules");
  if (!existsSync(rulesPath)) {
    return emptyResult;
  }

  let currentBundleHash: string;
  try {
    const rules = await loadRulesDirectory(rulesPath, basePath);
    const currentLockfile = generateLockfile(rules, basePath);
    currentBundleHash = currentLockfile.bundle_hash;
  } catch {
    // Can't compute current hash, no drift detection possible
    return emptyResult;
  }

  // Detect lockfile drift
  const findings = detectLockfileDrift(lockfile, currentBundleHash);

  return {
    has_drift: findings.length > 0,
    findings,
    summary: {
      total: findings.length,
      by_category: {
        lockfile: findings.length,
      },
    },
  };
}
