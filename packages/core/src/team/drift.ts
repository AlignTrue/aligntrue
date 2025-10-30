/**
 * Drift detection for team mode
 * Detects misalignment between lockfile and approved sources
 */

import { existsSync, readFileSync } from "fs";
import { parseAllowList } from "./allow.js";
import type { AllowList, AllowListSource } from "./types.js";
import type { Lockfile, LockfileEntry } from "../lockfile/types.js";
import { join } from "path";
import { computeHash } from "@aligntrue/schema";

/**
 * Drift categories
 */
export type DriftCategory =
  | "upstream" // Lockfile hash differs from allowed version
  | "severity_remap" // Severity remapping rules changed (Session 7)
  | "vendorized" // Vendored pack differs from source
  | "local_overlay"; // Local overlays changed (Phase 3.5)

/**
 * Individual drift finding
 */
export interface DriftFinding {
  category: DriftCategory;
  rule_id: string;
  message: string;
  suggestion: string;
  // Context fields vary by category
  lockfile_hash?: string;
  expected_hash?: string;
  source?: string;
  vendor_path?: string;
  vendor_type?: "submodule" | "subtree" | "manual";
}

/**
 * Drift detection result
 */
export interface DriftResult {
  has_drift: boolean;
  findings: DriftFinding[];
  summary: {
    total: number;
    by_category: Record<DriftCategory, number>;
  };
}

/**
 * Detect upstream drift
 * Compares lockfile hashes with allowed source hashes
 */
export function detectUpstreamDrift(
  lockfile: Lockfile,
  allowList: AllowList,
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  for (const entry of lockfile.rules) {
    // Skip entries without source (local rules)
    if (!entry.source) {
      continue;
    }

    // Find matching allow list entry
    const allowedSource = allowList.sources.find(
      (s: AllowListSource) =>
        s.value === entry.source ||
        s.value.includes(entry.source || "") ||
        (entry.source || "").includes(s.value),
    );

    if (!allowedSource) {
      // Source not in allow list - this should be caught by validation
      // but we'll report it as drift anyway
      findings.push({
        category: "upstream",
        rule_id: entry.rule_id,
        message: `Source not in allow list: ${entry.source}`,
        suggestion: `Run: aligntrue team approve ${entry.source}`,
        lockfile_hash: entry.content_hash,
        source: entry.source,
      });
      continue;
    }

    // Check if resolved hash exists and differs
    if (allowedSource.resolved_hash) {
      if (entry.content_hash !== allowedSource.resolved_hash) {
        findings.push({
          category: "upstream",
          rule_id: entry.rule_id,
          message: `Lockfile hash differs from allowed version`,
          suggestion: `Run: aligntrue team approve ${entry.source}\nOr:  aligntrue sync --force to accept current version`,
          lockfile_hash: entry.content_hash,
          expected_hash: allowedSource.resolved_hash,
          source: entry.source,
        });
      }
    }
  }

  return findings;
}

/**
 * Detect vendorized drift
 * Compares vendored pack hash with source hash
 */
export function detectVendorizedDrift(
  lockfile: Lockfile,
  basePath: string = ".",
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  for (const entry of lockfile.rules) {
    // Skip entries without vendor info
    if (!entry.vendor_path) {
      continue;
    }

    // Check if vendored path exists
    const vendorPath = join(basePath, entry.vendor_path);
    if (!existsSync(vendorPath)) {
      const finding: DriftFinding = {
        category: "vendorized",
        rule_id: entry.rule_id,
        message: `Vendored pack not found at ${entry.vendor_path}`,
        suggestion: `Restore vendored pack or run: aligntrue sync`,
        lockfile_hash: entry.content_hash,
        vendor_path: entry.vendor_path,
      };
      if (entry.vendor_type) {
        finding.vendor_type = entry.vendor_type;
      }
      findings.push(finding);
      continue;
    }

    // Check if .aligntrue.yaml exists in vendored path
    const vendorConfigPath = join(vendorPath, ".aligntrue.yaml");
    if (!existsSync(vendorConfigPath)) {
      const finding: DriftFinding = {
        category: "vendorized",
        rule_id: entry.rule_id,
        message: `Vendored pack missing .aligntrue.yaml at ${entry.vendor_path}`,
        suggestion: `Ensure vendor path contains valid AlignTrue pack`,
        lockfile_hash: entry.content_hash,
        vendor_path: entry.vendor_path,
      };
      if (entry.vendor_type) {
        finding.vendor_type = entry.vendor_type;
      }
      findings.push(finding);
      continue;
    }

    // For now, we can't easily compute the hash of the vendored pack
    // without running the full pack loader. This would be a more complex
    // operation. We'll defer detailed vendored hash comparison to when
    // we have better pack loading infrastructure.
    // TODO: Add actual hash comparison when pack loading is refactored
    // For now, just check if the vendored pack exists and is valid
  }

  return findings;
}

/**
 * Detect severity remap drift
 * Checks if .aligntrue.team.yaml has changed since lockfile generation
 */
export function detectSeverityRemapDrift(
  lockfile: Lockfile,
  basePath: string = ".",
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  const teamYamlPath = join(basePath, ".aligntrue.team.yaml");

  // If lockfile has no team_yaml_hash, no drift to detect
  if (!lockfile.team_yaml_hash) {
    return findings;
  }

  // Check if team.yaml file exists
  if (!existsSync(teamYamlPath)) {
    findings.push({
      category: "severity_remap",
      rule_id: "_team_policy",
      message: "Team policy file removed since lockfile generation",
      suggestion: "Restore .aligntrue.team.yaml or regenerate lockfile",
    });
    return findings;
  }

  // Compute current hash
  let currentHash: string;
  try {
    const content = readFileSync(teamYamlPath, "utf-8");
    currentHash = computeHash(content);
  } catch (err) {
    findings.push({
      category: "severity_remap",
      rule_id: "_team_policy",
      message: `Failed to read team policy file: ${err instanceof Error ? err.message : String(err)}`,
      suggestion: "Check file permissions and validity",
    });
    return findings;
  }

  // Compare hashes
  if (currentHash !== lockfile.team_yaml_hash) {
    findings.push({
      category: "severity_remap",
      rule_id: "_team_policy",
      message: "Team severity remapping policy has changed",
      suggestion:
        "Review changes and regenerate lockfile if approved: aligntrue lock",
    });
  }

  return findings;
}

/**
 * Detect local overlay drift
 * Placeholder for Phase 3.5 implementation
 */
export function detectLocalOverlayDrift(
  _lockfile: Lockfile,
  _basePath: string = ".",
): DriftFinding[] {
  // TODO(Phase 3.5): Implement local overlay drift detection
  // Will check if local rule overlays have changed
  return [];
}

/**
 * High-level drift detection for CLI usage
 * Takes config object and handles file paths internally
 */
export function detectDriftForConfig(config: any): Promise<{
  driftDetected: boolean;
  mode: string;
  lockfilePath: string;
  summary?: string | undefined;
  drift: Array<{
    category: DriftCategory;
    ruleId: string;
    description: string;
    suggestion?: string | undefined;
  }>;
}> {
  const basePath = config.rootDir || ".";
  const lockfilePath = config.lockfilePath || ".aligntrue.lock.json";
  const allowListPath = config.allowListPath || ".aligntrue.allow.yaml";

  try {
    const result = detectDrift(lockfilePath, allowListPath, basePath);

    return Promise.resolve({
      driftDetected: result.has_drift,
      mode: "team", // Always team mode when drift detection runs
      lockfilePath,
      summary: result.has_drift
        ? `${result.summary.total} drift findings across ${Object.values(result.summary.by_category).filter((n) => (n as number) > 0).length} categories`
        : "",
      drift: result.findings.map((f: DriftFinding) => ({
        category: f.category,
        ruleId: f.rule_id,
        description: f.message,
        suggestion: f.suggestion,
      })),
    });
  } catch (error) {
    // If files don't exist, no drift
    return Promise.resolve({
      driftDetected: false,
      mode: "team",
      lockfilePath,
      drift: [],
    });
  }
}

/**
 * Main drift detection orchestrator
 * Combines all drift detection categories
 */
export function detectDrift(
  lockfilePath: string,
  allowListPath: string,
  basePath: string = ".",
): DriftResult {
  // Check if lockfile exists
  if (!existsSync(lockfilePath)) {
    return {
      has_drift: false,
      findings: [],
      summary: {
        total: 0,
        by_category: {
          upstream: 0,
          severity_remap: 0,
          vendorized: 0,
          local_overlay: 0,
        },
      },
    };
  }

  // Check if allow list exists
  if (!existsSync(allowListPath)) {
    return {
      has_drift: false,
      findings: [],
      summary: {
        total: 0,
        by_category: {
          upstream: 0,
          severity_remap: 0,
          vendorized: 0,
          local_overlay: 0,
        },
      },
    };
  }

  // Parse lockfile
  let lockfile: Lockfile;
  try {
    const lockfileContent = readFileSync(lockfilePath, "utf-8");
    lockfile = JSON.parse(lockfileContent) as Lockfile;
  } catch (err) {
    throw new Error(
      `Failed to parse lockfile: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Parse allow list
  let allowList: AllowList;
  try {
    allowList = parseAllowList(allowListPath);
  } catch (err) {
    throw new Error(
      `Failed to parse allow list: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Run all drift detection checks
  const findings: DriftFinding[] = [];
  findings.push(...detectUpstreamDrift(lockfile, allowList));
  findings.push(...detectVendorizedDrift(lockfile, basePath));
  findings.push(...detectSeverityRemapDrift(lockfile, basePath));
  findings.push(...detectLocalOverlayDrift(lockfile, basePath));

  // Calculate summary
  const by_category: Record<DriftCategory, number> = {
    upstream: findings.filter((f) => f.category === "upstream").length,
    severity_remap: findings.filter((f) => f.category === "severity_remap")
      .length,
    vendorized: findings.filter((f) => f.category === "vendorized").length,
    local_overlay: findings.filter((f) => f.category === "local_overlay")
      .length,
  };

  return {
    has_drift: findings.length > 0,
    findings,
    summary: {
      total: findings.length,
      by_category,
    },
  };
}
