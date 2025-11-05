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
 * Drift categories (Phase 3.5 enhanced)
 */
export type DriftCategory =
  | "upstream" // base_hash differs: upstream pack updated
  | "overlay" // overlay_hash differs: local overlay config changed
  | "result" // result_hash differs: unexpected application result
  | "severity_remap" // Severity remapping rules changed (Session 7)
  | "vendorized" // Vendored pack differs from source
  | "local_overlay"; // Legacy: use "overlay" instead

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
  // Phase 3.5: Triple-hash details for granular drift
  base_hash?: string;
  overlay_hash?: string;
  result_hash?: string;
  expected_base_hash?: string;
  expected_overlay_hash?: string;
  expected_result_hash?: string;
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
      upstream: number;
      overlay: number;
      result: number;
      severity_remap: number;
      vendorized: number;
      local_overlay: number;
    };
  };
}

/**
 * Detect upstream drift (Phase 3.5 enhanced)
 * Compares base_hash (when available) with allowed source hashes
 * Falls back to content_hash for backward compatibility
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
    // Phase 3.5: Use base_hash if available (more precise for overlays)
    const hashToCompare = entry.base_hash || entry.content_hash;
    if (allowedSource.resolved_hash) {
      if (hashToCompare !== allowedSource.resolved_hash) {
        const finding: DriftFinding = {
          category: "upstream",
          rule_id: entry.rule_id,
          message: entry.base_hash
            ? "Upstream pack has been updated (base_hash differs)"
            : "Lockfile hash differs from allowed version",
          suggestion: `Run: aligntrue update apply\nOr:  aligntrue team approve ${entry.source} --force`,
          lockfile_hash: hashToCompare,
          expected_hash: allowedSource.resolved_hash,
          source: entry.source,
        };

        // Include triple-hash details when available
        if (entry.base_hash) {
          finding.base_hash = entry.base_hash;
          finding.expected_base_hash = allowedSource.resolved_hash;
        }
        if (entry.overlay_hash) {
          finding.overlay_hash = entry.overlay_hash;
        }
        if (entry.result_hash) {
          finding.result_hash = entry.result_hash;
        }

        findings.push(finding);
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
  } catch (_err) {
    findings.push({
      category: "severity_remap",
      rule_id: "_team_policy",
      message: `Failed to read team policy file: ${_err instanceof Error ? _err.message : String(_err)}`,
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
 * Detect overlay drift (Phase 3.5)
 * Checks if overlay_hash differs, indicating overlay config changed
 */
export function detectOverlayDrift(
  lockfileEntries: LockfileEntry[],
  currentOverlayHash?: string,
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  for (const entry of lockfileEntries) {
    // Skip entries without overlay_hash (no overlays applied)
    if (!entry.overlay_hash) {
      continue;
    }

    // Compare with current overlay hash
    if (currentOverlayHash && entry.overlay_hash !== currentOverlayHash) {
      findings.push({
        category: "overlay",
        rule_id: entry.rule_id,
        message: "Overlay configuration has changed since lockfile generation",
        suggestion: "Regenerate lockfile: aligntrue lock",
        overlay_hash: entry.overlay_hash,
        expected_overlay_hash: currentOverlayHash,
      });
    }
  }

  return findings;
}

/**
 * Detect result drift (Phase 3.5)
 * Checks if result_hash differs while base_hash and overlay_hash match
 * Indicates unexpected behavior in overlay application
 */
export function detectResultDrift(
  lockfileEntries: LockfileEntry[],
  currentResults: Map<string, string>, // rule_id -> current result_hash
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  for (const entry of lockfileEntries) {
    // Skip entries without triple-hash format
    if (!entry.result_hash || !entry.base_hash || !entry.overlay_hash) {
      continue;
    }

    const currentResultHash = currentResults.get(entry.rule_id);
    if (!currentResultHash) {
      continue;
    }

    // Result drift: base and overlay match but result differs
    if (entry.result_hash !== currentResultHash) {
      findings.push({
        category: "result",
        rule_id: entry.rule_id,
        message: "Result hash differs despite matching base and overlay hashes",
        suggestion:
          "This indicates non-deterministic overlay application. Report issue.",
        result_hash: entry.result_hash,
        expected_result_hash: currentResultHash,
        base_hash: entry.base_hash,
        overlay_hash: entry.overlay_hash,
      });
    }
  }

  return findings;
}

/**
 * Detect local overlay drift (legacy)
 * Deprecated: Use detectOverlayDrift instead
 */
export function detectLocalOverlayDrift(
  _lockfile: Lockfile,
  _basePath: string = ".",
): DriftFinding[] {
  // Legacy placeholder - use detectOverlayDrift for Phase 3.5
  return [];
}

/**
 * High-level drift detection for CLI usage
 * Takes config object and handles file paths internally
 */
export function detectDriftForConfig(config: unknown): Promise<{
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
    vendor_path?: string;
    vendor_type?: string;
  }>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configAsAny = config as any;
  const basePath = configAsAny.rootDir || ".";
  const lockfilePath = configAsAny.lockfilePath || ".aligntrue.lock.json";
  const allowListPath = configAsAny.allowListPath || ".aligntrue/allow.yaml";

  try {
    const result = detectDrift(lockfilePath, allowListPath, basePath);

    return Promise.resolve({
      driftDetected: result.has_drift,
      mode: "team", // Always team mode when drift detection runs
      lockfilePath,
      summary: result.has_drift
        ? `${result.summary.total} drift findings across ${Object.values(result.summary.by_category).filter((n) => (n as number) > 0).length} categories`
        : "",
      drift: result.findings.map((f: DriftFinding) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item: any = {
          category: f.category,
          ruleId: f.rule_id,
          description: f.message,
          suggestion: f.suggestion,
        };
        if (f.lockfile_hash) item.lockfile_hash = f.lockfile_hash;
        if (f.expected_hash) item.expected_hash = f.expected_hash;
        if (f.vendor_path) item.vendor_path = f.vendor_path;
        if (f.vendor_type) item.vendor_type = f.vendor_type;
        return item;
      }),
    });
  } catch {
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
          overlay: 0,
          result: 0,
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
          overlay: 0,
          result: 0,
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
  } catch (_err) {
    throw new Error(
      `Failed to parse lockfile: ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }

  // Parse allow list
  let allowList: AllowList;
  try {
    allowList = parseAllowList(allowListPath);
  } catch (_err) {
    throw new Error(
      `Failed to parse allow list: ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }

  // Run all drift detection checks
  const findings: DriftFinding[] = [];
  findings.push(...detectUpstreamDrift(lockfile, allowList));
  findings.push(...detectVendorizedDrift(lockfile, basePath));
  findings.push(...detectSeverityRemapDrift(lockfile, basePath));
  findings.push(...detectLocalOverlayDrift(lockfile, basePath));

  // Calculate summary (Phase 3.5: includes new categories)
  const by_category = {
    upstream: findings.filter((f) => f.category === "upstream").length,
    overlay: findings.filter((f) => f.category === "overlay").length,
    result: findings.filter((f) => f.category === "result").length,
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
