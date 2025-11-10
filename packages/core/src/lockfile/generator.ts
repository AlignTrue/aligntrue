/**
 * Lockfile generator with per-rule and bundle hashing
 * Phase 3.5: Supports triple-hash format for overlay tracking
 */

import { existsSync, readFileSync } from "fs";
import type { AlignPack, AlignRule, AlignSection } from "@aligntrue/schema";
import {
  computeContentHash,
  computeHash,
  getSections,
} from "@aligntrue/schema";
import type { Lockfile, LockfileEntry } from "./types.js";
import { computeDualHash } from "../plugs/hashing.js";
import type { OverlayDefinition } from "../overlays/types.js";

/**
 * Generate lockfile from an AlignPack bundle
 *
 * Uses canonical JSON (JCS) with vendor.volatile fields excluded
 * Phase 3.5: Supports triple-hash format when overlays are present
 *
 * @param pack - AlignPack to generate lockfile from
 * @param mode - Config mode (team or enterprise)
 * @param teamYamlPath - Optional path to .aligntrue.team.yaml for hash capture
 * @param overlays - Optional overlay definitions applied to this pack
 * @param basePack - Optional base pack (before overlays) for triple-hash
 * @returns Lockfile with per-rule and bundle hashes
 */
export function generateLockfile(
  pack: AlignPack,
  mode: "team" | "enterprise",
  teamYamlPath?: string,
  overlays?: OverlayDefinition[],
  basePack?: AlignPack,
): Lockfile {
  const entries: LockfileEntry[] = [];
  const contentHashes: string[] = [];

  // Determine if pack uses sections or rules
  const sections = getSections(pack);
  const useSections = sections.length > 0;

  // Compute dual hashes for plugs (Phase 2.5)
  let dualHashResult: ReturnType<typeof computeDualHash> | undefined;
  if (pack.plugs) {
    dualHashResult = computeDualHash(pack);
  }

  // Compute overlay hash if overlays present (Phase 3.5)
  const overlayHash =
    overlays && overlays.length > 0 ? computeOverlayHash(overlays) : undefined;

  if (useSections) {
    // Phase 8: Generate entries from sections using fingerprints
    for (const section of sections) {
      const resultHash = hashSection(section);

      // Compute base hash if base pack provided (Phase 3.5)
      let baseHash: string | undefined;
      if (basePack) {
        const baseSections = getSections(basePack);
        const baseSection = baseSections.find(
          (s) => s.fingerprint === section.fingerprint,
        );
        if (baseSection) {
          baseHash = hashSection(baseSection);
        }
      }

      const entry: LockfileEntry = {
        rule_id: section.fingerprint, // Use fingerprint as ID for sections
        content_hash: resultHash, // Alias to result_hash for backward compatibility
        ...(pack.owner && { owner: pack.owner }),
        ...(pack.source && { source: pack.source }),
        ...(pack.source_sha && { source_sha: pack.source_sha }),
        // Phase 3.5: Triple-hash format when overlays present
        ...(baseHash && { base_hash: baseHash }),
        ...(overlayHash && { overlay_hash: overlayHash }),
        ...(overlayHash && { result_hash: resultHash }),
        // Phase 3, Session 5: Capture vendoring provenance
        ...(pack.vendor_path && { vendor_path: pack.vendor_path }),
        ...(pack.vendor_type && { vendor_type: pack.vendor_type }),
      };

      // Add plugs hashes if pack has plugs (Phase 2.5)
      if (dualHashResult) {
        entry.pre_resolution_hash = dualHashResult.preResolutionHash;
        if (dualHashResult.postResolutionHash) {
          entry.post_resolution_hash = dualHashResult.postResolutionHash;
        }
      }

      entries.push(entry);
      contentHashes.push(resultHash);
    }
  } else {
    // Generate per-rule hashes with full provenance (legacy)
    for (const rule of pack.rules || []) {
      const resultHash = hashRule(rule);

      // Compute base hash if base pack provided (Phase 3.5)
      let baseHash: string | undefined;
      if (basePack) {
        const baseRule = basePack.rules?.find((r) => r.id === rule.id);
        if (baseRule) {
          baseHash = hashRule(baseRule);
        }
      }

      const entry: LockfileEntry = {
        rule_id: rule.id,
        content_hash: resultHash, // Alias to result_hash for backward compatibility
        ...(pack.owner && { owner: pack.owner }),
        ...(pack.source && { source: pack.source }),
        ...(pack.source_sha && { source_sha: pack.source_sha }),
        // Phase 3.5: Triple-hash format when overlays present
        ...(baseHash && { base_hash: baseHash }),
        ...(overlayHash && { overlay_hash: overlayHash }),
        ...(overlayHash && { result_hash: resultHash }),
        // Phase 3, Session 5: Capture vendoring provenance
        ...(pack.vendor_path && { vendor_path: pack.vendor_path }),
        ...(pack.vendor_type && { vendor_type: pack.vendor_type }),
      };

      // Add plugs hashes if pack has plugs (Phase 2.5)
      if (dualHashResult) {
        entry.pre_resolution_hash = dualHashResult.preResolutionHash;
        if (dualHashResult.postResolutionHash) {
          entry.post_resolution_hash = dualHashResult.postResolutionHash;
        }
        // Note: We track unresolved count at pack level, not per-rule
      }

      entries.push(entry);
      contentHashes.push(resultHash);
    }
  }

  // Sort entries by rule_id for determinism
  entries.sort((a, b) => a.rule_id.localeCompare(b.rule_id));

  // Generate bundle hash from sorted content hashes
  const bundleHash = computeBundleHash(contentHashes.sort());

  // Phase 3, Session 7: Capture team.yaml hash if file exists
  const teamYamlHash = teamYamlPath
    ? computeTeamYamlHash(teamYamlPath)
    : undefined;

  // Build lockfile result
  const lockfile: Lockfile = {
    version: "1",
    generated_at: new Date().toISOString(),
    mode,
    rules: entries,
    bundle_hash: bundleHash,
  };

  // Add optional fields
  if (teamYamlHash) {
    lockfile.team_yaml_hash = teamYamlHash;
  }

  // Phase 2.5: Add total unresolved plugs count
  if (dualHashResult && dualHashResult.unresolvedRequired.length > 0) {
    lockfile.total_unresolved_plugs = dualHashResult.unresolvedRequired.length;
  }

  return lockfile;
}

/**
 * Hash a single rule using canonical JSON (excludes vendor.volatile)
 */
export function hashRule(rule: AlignRule): string {
  return computeContentHash(rule, true);
}

/**
 * Hash a single section using canonical JSON
 * Phase 8: Section hashing for natural markdown support
 */
export function hashSection(section: AlignSection): string {
  return computeContentHash(section, true);
}

/**
 * Compute bundle hash from sorted rule hashes
 */
function computeBundleHash(sortedHashes: string[]): string {
  const combined = sortedHashes.join("\n");
  return computeHash(combined);
}

/**
 * Compute hash of .aligntrue.team.yaml file
 * Returns undefined if file doesn't exist
 */
function computeTeamYamlHash(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    const content = readFileSync(path, "utf-8");
    return computeHash(content);
  } catch {
    return undefined;
  }
}

/**
 * Compute hash of overlay configuration (Phase 3.5)
 * Uses canonical JSON for deterministic hashing
 *
 * @param overlays - Array of overlay definitions
 * @returns SHA-256 hash of canonicalized overlays
 */
export function computeOverlayHash(overlays: OverlayDefinition[]): string {
  // Sort overlays by selector for determinism
  const sortedOverlays = [...overlays].sort((a, b) =>
    a.selector.localeCompare(b.selector),
  );

  return computeContentHash(sortedOverlays, false);
}
