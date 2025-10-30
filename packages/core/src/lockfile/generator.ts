/**
 * Lockfile generator with per-rule and bundle hashing
 */

import type { AlignPack, AlignRule } from "@aligntrue/schema";
import { canonicalizeJson, computeHash } from "@aligntrue/schema";
import type { Lockfile, LockfileEntry } from "./types.js";

/**
 * Generate lockfile from an AlignPack bundle
 *
 * Uses canonical JSON (JCS) with vendor.volatile fields excluded
 *
 * @param pack - AlignPack to generate lockfile from
 * @param mode - Config mode (team or enterprise)
 * @returns Lockfile with per-rule and bundle hashes
 */
export function generateLockfile(
  pack: AlignPack,
  mode: "team" | "enterprise",
): Lockfile {
  const entries: LockfileEntry[] = [];
  const ruleHashes: string[] = [];

  // Generate per-rule hashes with full provenance
  for (const rule of pack.rules || []) {
    const hash = hashRule(rule);
    entries.push({
      rule_id: rule.id,
      content_hash: hash,
      ...(pack.owner && { owner: pack.owner }),
      ...(pack.source && { source: pack.source }),
      ...(pack.source_sha && { source_sha: pack.source_sha }),
      // Phase 3.5: Capture base_hash from git sources when available
      // Git sources provide source_sha (commit SHA) which serves as base_hash
      // TODO(Phase 4): Capture base_hash from catalog sources when ready
      ...(pack.source_sha && { base_hash: pack.source_sha }),
      // Phase 3, Session 5: Capture vendoring provenance
      ...(pack.vendor_path && { vendor_path: pack.vendor_path }),
      ...(pack.vendor_type && { vendor_type: pack.vendor_type }),
    });
    ruleHashes.push(hash);
  }

  // Sort entries by rule_id for determinism
  entries.sort((a, b) => a.rule_id.localeCompare(b.rule_id));

  // Generate bundle hash from sorted rule hashes
  const bundleHash = computeBundleHash(ruleHashes.sort());

  return {
    version: "1",
    generated_at: new Date().toISOString(),
    mode,
    rules: entries,
    bundle_hash: bundleHash,
  };
}

/**
 * Hash a single rule using canonical JSON (excludes vendor.volatile)
 */
export function hashRule(rule: AlignRule): string {
  // Canonicalize with volatile field exclusion
  const canonical = canonicalizeJson(rule, true);
  return computeHash(canonical);
}

/**
 * Compute bundle hash from sorted rule hashes
 */
function computeBundleHash(sortedHashes: string[]): string {
  const combined = sortedHashes.join("\n");
  return computeHash(combined);
}
