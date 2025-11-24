/**
 * Lockfile generator with per-section and bundle hashing
 * Supports triple-hash format for overlay tracking (Overlays system)
 */

import { existsSync, readFileSync } from "fs";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import { computeContentHash, computeHash } from "@aligntrue/schema";
import type { Lockfile, LockfileEntry } from "./types.js";
import { computeDualHash } from "../plugs/hashing.js";
import type { OverlayDefinition } from "../overlays/types.js";
import { ensureSectionsArray } from "../validation/sections.js";
import type { RuleFile } from "../rules/file-io.js";

/**
 * Generate lockfile from an AlignPack bundle
 *
 * Uses canonical JSON (JCS) with vendor.volatile fields excluded
 * Supports triple-hash format when overlays are present (Overlays system)
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

  // Compute dual hashes for plugs (Plugs system)
  let dualHashResult: ReturnType<typeof computeDualHash> | undefined;
  if (pack.plugs) {
    dualHashResult = computeDualHash(pack);
  }

  // Compute overlay hash if overlays present (Overlays system)
  const overlayHash =
    overlays && overlays.length > 0 ? computeOverlayHash(overlays) : undefined;

  // Defensive: ensure sections exists
  ensureSectionsArray(pack, { throwOnInvalid: true });

  // Filter to only team-scoped sections (exclude personal sections from lockfile)
  const teamSections = pack.sections.filter(
    (section) => section.scope !== "personal",
  );

  // Track personal sections count for metadata
  const personalSectionsCount = pack.sections.length - teamSections.length;

  // Generate entries from team sections using fingerprints
  for (const section of teamSections) {
    const resultHash = hashSection(section);

    // Compute base hash if base pack provided (Overlays system)
    let baseHash: string | undefined;
    if (basePack) {
      const baseSection = basePack.sections.find(
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
      // Triple-hash format when overlays present (Overlays system)
      ...(baseHash && { base_hash: baseHash }),
      ...(overlayHash && { overlay_hash: overlayHash }),
      ...(overlayHash && { result_hash: resultHash }),
      // Team mode: Capture vendoring provenance
      ...(pack.vendor_path && { vendor_path: pack.vendor_path }),
      ...(pack.vendor_type && { vendor_type: pack.vendor_type }),
    };

    // Add plugs hashes if pack has plugs (Plugs system)
    if (dualHashResult) {
      entry.pre_resolution_hash = dualHashResult.preResolutionHash;
      if (dualHashResult.postResolutionHash) {
        entry.post_resolution_hash = dualHashResult.postResolutionHash;
      }
    }

    entries.push(entry);
    contentHashes.push(resultHash);
  }

  // Sort entries by rule_id for determinism
  entries.sort((a, b) => a.rule_id.localeCompare(b.rule_id));

  // Generate bundle hash from sorted content hashes
  const bundleHash = computeBundleHash(contentHashes.sort());

  // Team mode: Capture team.yaml hash if file exists
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

  // Plugs system: Add total unresolved plugs count
  if (dualHashResult && dualHashResult.unresolvedRequired.length > 0) {
    lockfile.total_unresolved_plugs = dualHashResult.unresolvedRequired.length;
  }

  // Add personal sections count if any exist
  if (personalSectionsCount > 0) {
    lockfile.personal_rules_count = personalSectionsCount;
  }

  return lockfile;
}

/**
 * Generate lockfile from RuleFiles
 * @param rules Array of rule files
 * @param mode Config mode
 */
export function generateLockfileFromRules(
  rules: RuleFile[],
  mode: "team" | "enterprise",
): Lockfile {
  const entries: LockfileEntry[] = [];
  const contentHashes: string[] = [];

  for (const rule of rules) {
    const hash = rule.hash;
    const entry: LockfileEntry = {
      rule_id: rule.path, // Use relative path as ID
      content_hash: hash,
    };

    entries.push(entry);
    contentHashes.push(hash);
  }

  // Sort entries by rule_id for determinism
  entries.sort((a, b) => a.rule_id.localeCompare(b.rule_id));

  // Generate bundle hash from sorted content hashes
  const bundleHash = computeBundleHash(contentHashes.sort());

  return {
    version: "1",
    generated_at: new Date().toISOString(),
    mode,
    rules: entries,
    bundle_hash: bundleHash,
  };
}

/**
 * Hash a single section using canonical JSON
 * Section hashing for natural markdown support (Team mode enhancements)
 */
export function hashSection(section: AlignSection): string {
  return computeContentHash(section, true);
}

/**
 * Hash a rule file
 */
export function hashRuleFile(rule: RuleFile): string {
  return rule.hash;
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
 * Compute hash of overlay configuration (Overlays system)
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
