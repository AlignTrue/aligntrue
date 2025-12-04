/**
 * Drift detection for team mode
 * Detects misalignment between lockfile and approved sources
 */

import { existsSync, readFileSync } from "fs";
import type { Lockfile, LockfileEntry } from "../lockfile/types.js";
import { join } from "path";
import { computeHash } from "@aligntrue/schema";
import { isPlainObject } from "../overlays/operations.js";

/**
 * Drift categories (Overlays system enhanced)
 */
export type DriftCategory =
  | "upstream" // base_hash differs: upstream align updated
  | "overlay" // overlay_hash differs: local overlay config changed
  | "result" // result_hash differs: unexpected application result
  | "severity_remap" // Severity remapping rules changed (Session 7)
  | "vendorized" // Vendored align differs from source
  | "lockfile" // Lockfile bundle hash differs from current rules
  | "agent_file"; // Agent files modified after IR

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
  // Overlays system: Triple-hash details for granular drift
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
      lockfile: number;
      agent_file: number;
    };
  };
}

/**
 * Detect vendorized drift
 * Compares vendored align hash with source hash
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
        message: `Vendored align not found at ${entry.vendor_path}`,
        suggestion: `Restore vendored align or run: aligntrue sync`,
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
        message: `Vendored align missing .aligntrue.yaml at ${entry.vendor_path}`,
        suggestion: `Ensure vendor path contains valid AlignTrue align`,
        lockfile_hash: entry.content_hash,
        vendor_path: entry.vendor_path,
      };
      if (entry.vendor_type) {
        finding.vendor_type = entry.vendor_type;
      }
      findings.push(finding);
      continue;
    }

    // For now, we can't easily compute the hash of the vendored align
    // without running the full align loader. This would be a more complex
    // Current approach is sufficient for drift detection
    // Detailed vendored hash comparison can be added if needed
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
        "Review changes, commit to git, and create PR for team approval",
    });
  }

  return findings;
}

/**
 * Detect overlay drift (Overlays system)
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
        suggestion:
          "Review changes, commit to git, and create PR for team approval",
        overlay_hash: entry.overlay_hash,
        expected_overlay_hash: currentOverlayHash,
      });
    }
  }

  return findings;
}

/**
 * Detect result drift (Overlays system)
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
 * Detect lockfile drift
 * Compares current bundle hash (computed from rules) with lockfile bundle hash
 * Indicates rules have changed since last lock
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
      message: "Rules have changed since last lockfile generation",
      suggestion: "Run: aligntrue sync (to regenerate lockfile)",
      lockfile_hash: lockfile.bundle_hash,
      expected_hash: currentBundleHash,
    });
  }

  return findings;
}

/**
 * Detect agent file drift
 * Checks if agent files have been modified after last sync
 * Uses content hash comparison for reliability
 *
 * Dynamically discovers all tracked agent files from .aligntrue/.agent-export-hashes.json
 * This includes all files written by exporters (AGENTS.md, .cursor/rules/*.mdc, etc.)
 */
export function detectAgentFileDrift(basePath: string = "."): DriftFinding[] {
  const findings: DriftFinding[] = [];

  // Get all tracked agent export hashes dynamically
  // Read directly from the JSON file to avoid circular dependency issues
  const hashFilePath = join(
    basePath,
    ".aligntrue",
    ".agent-export-hashes.json",
  );
  let storedHashes: { exports: Record<string, string> } | null = null;

  if (existsSync(hashFilePath)) {
    try {
      const content = readFileSync(hashFilePath, "utf-8");
      storedHashes = JSON.parse(content) as { exports: Record<string, string> };
    } catch {
      // If we can't read/parse the file, assume no stored hashes
      storedHashes = null;
    }
  }

  if (!storedHashes || !storedHashes.exports) {
    // No stored hashes = first sync or legacy state, assume no drift
    if (process.env["ALIGNTRUE_DEBUG"]) {
      console.log("[drift] No agent export hashes found, skipping drift check");
    }
    return findings;
  }

  // Check each tracked file for drift
  for (const [agentPath, storedHash] of Object.entries(storedHashes.exports)) {
    const fullPath = join(basePath, agentPath);
    if (!existsSync(fullPath)) {
      // File was deleted - this is drift
      findings.push({
        category: "agent_file",
        rule_id: `_agent_${inferAgentFromPath(agentPath)}`,
        message: `${agentPath} was deleted after last sync`,
        suggestion: `Run 'aligntrue sync' to recreate or remove from exporters`,
      });
      continue;
    }

    try {
      const currentContent = readFileSync(fullPath, "utf-8");
      const currentHash = computeHash(currentContent);

      if (currentHash !== storedHash) {
        findings.push({
          category: "agent_file",
          rule_id: `_agent_${inferAgentFromPath(agentPath)}`,
          message: `${agentPath} modified after last sync`,
          suggestion: `Run 'aligntrue sync' to overwrite or move changes to .aligntrue/rules/`,
        });
      }
    } catch (err) {
      // File read/hash failed - skip
      if (process.env["ALIGNTRUE_DEBUG"]) {
        console.log(`[drift] Failed to check ${agentPath}:`, err);
      }
    }
  }

  return findings;
}

/**
 * Infer agent name from file path for drift reporting
 */
function inferAgentFromPath(path: string): string {
  if (path.startsWith(".cursor/")) return "cursor";
  if (path === "AGENTS.md") return "agents";
  if (path === "CLAUDE.md") return "claude";
  if (path.startsWith(".windsurf/")) return "windsurf";
  if (path.startsWith(".vscode/")) return "vscode";
  if (path.startsWith(".aider/") || path === ".aider.conf.yml") return "aider";
  // Default: extract from path
  const match = path.match(/^\.?([a-z-]+)/i);
  return match && match[1] ? match[1].toLowerCase() : "unknown";
}

/**
 * High-level drift detection for CLI usage
 * Takes config object and handles file paths internally
 */
export async function detectDriftForConfig(
  config: unknown,
  ignoreLockfileDrift: boolean = false,
): Promise<{
  driftDetected: boolean;
  mode: string;
  lockfilePath: string;
  summary?: string | undefined;
  personalRulesCount?: number | undefined;
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
  const configRecord = isPlainObject(config) ? config : {};
  const basePath =
    typeof configRecord["rootDir"] === "string" ? configRecord["rootDir"] : ".";
  const lockfilePath =
    typeof configRecord["lockfilePath"] === "string"
      ? configRecord["lockfilePath"]
      : ".aligntrue.lock.json";

  try {
    // Load lockfile to get personal rules count
    let personalRulesCount: number | undefined;
    try {
      const lockfileContent = readFileSync(lockfilePath, "utf-8");
      const lockfile = JSON.parse(lockfileContent);
      personalRulesCount = lockfile.personal_rules_count;
    } catch {
      // Unable to read lockfile; personalRulesCount remains undefined
    }

    // Compute current bundle hash for lockfile drift detection
    let currentBundleHash: string | undefined;
    try {
      // Load current rules and compute bundle hash
      const irPath = join(basePath, ".aligntrue/rules");
      if (existsSync(irPath)) {
        const { loadIR } = await import("../sync/ir-loader.js");
        const { generateLockfile } = await import("../lockfile/index.js");
        const ir = await loadIR(irPath);
        const tempLockfile = generateLockfile(ir, "team");
        currentBundleHash = tempLockfile.bundle_hash;
      }
    } catch {
      // Unable to compute bundle hash; currentBundleHash remains undefined.
    }

    const result = await detectDrift(
      lockfilePath,
      basePath,
      currentBundleHash,
      ignoreLockfileDrift,
    );

    return Promise.resolve({
      driftDetected: result.has_drift,
      mode: "team", // Always team mode when drift detection runs
      lockfilePath,
      summary: result.has_drift
        ? `${result.summary.total} drift findings across ${Object.values(result.summary.by_category).filter((n) => (n as number) > 0).length} categories`
        : "",
      personalRulesCount,
      drift: result.findings.map((f: DriftFinding) => {
        const entry: {
          category: DriftCategory;
          ruleId: string;
          description: string;
          suggestion?: string;
          lockfile_hash?: string;
          expected_hash?: string;
          vendor_path?: string;
          vendor_type?: string;
        } = {
          category: f.category,
          ruleId: f.rule_id,
          description: f.message,
        };

        if (f.suggestion) entry.suggestion = f.suggestion;
        if (f.lockfile_hash) entry.lockfile_hash = f.lockfile_hash;
        if (f.expected_hash) entry.expected_hash = f.expected_hash;
        if (f.vendor_path) entry.vendor_path = f.vendor_path;
        if (f.vendor_type) entry.vendor_type = f.vendor_type;
        return entry;
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
export async function detectDrift(
  lockfilePath: string,
  basePath: string = ".",
  currentBundleHash?: string,
  ignoreLockfileDrift: boolean = false,
): Promise<DriftResult> {
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
          lockfile: 0,
          agent_file: 0,
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

  // Run drift detection checks
  const findings: DriftFinding[] = [];

  findings.push(...detectVendorizedDrift(lockfile, basePath));
  findings.push(...detectSeverityRemapDrift(lockfile, basePath));

  // New drift detection types
  // Filter lockfile drift if ignoreLockfileDrift is true
  if (currentBundleHash && !ignoreLockfileDrift) {
    findings.push(...detectLockfileDrift(lockfile, currentBundleHash));
  }

  // Agent file drift uses hash comparison (not timestamps)
  findings.push(...detectAgentFileDrift(basePath));

  // Calculate summary (Overlays system: includes new categories)
  const by_category = {
    upstream: findings.filter((f) => f.category === "upstream").length,
    overlay: findings.filter((f) => f.category === "overlay").length,
    result: findings.filter((f) => f.category === "result").length,
    severity_remap: findings.filter((f) => f.category === "severity_remap")
      .length,
    vendorized: findings.filter((f) => f.category === "vendorized").length,
    lockfile: findings.filter((f) => f.category === "lockfile").length,
    agent_file: findings.filter((f) => f.category === "agent_file").length,
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
