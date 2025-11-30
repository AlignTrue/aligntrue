/**
 * Lockfile generator with per-section and bundle hashing
 * Supports triple-hash format for overlay tracking (Overlays system)
 */

import { existsSync, readFileSync } from "fs";
import type { Align, AlignSection } from "@aligntrue/schema";
import { computeContentHash, computeHash } from "@aligntrue/schema";
import type { Lockfile, LockfileEntry } from "./types.js";
import { computeDualHash } from "../plugs/hashing.js";
import type { OverlayDefinition } from "../overlays/types.js";
import { ensureSectionsArray } from "../validation/sections.js";
import type { RuleFile } from "../rules/file-io.js";

/**
 * Generate lockfile from an Align bundle
 *
 * Uses canonical JSON (JCS) with vendor.volatile fields excluded
 * Supports triple-hash format when overlays are present (Overlays system)
 *
 * @param align - Align to generate lockfile from
 * @param mode - Config mode (team or enterprise)
 * @param teamYamlPath - Optional path to .aligntrue.team.yaml for hash capture
 * @param overlays - Optional overlay definitions applied to this align
 * @param baseAlign - Optional base align (before overlays) for triple-hash
 * @returns Lockfile with per-rule and bundle hashes
 */
export function generateLockfile(
  align: Align,
  mode: "team" | "enterprise",
  teamYamlPath?: string,
  overlays?: OverlayDefinition[],
  baseAlign?: Align,
): Lockfile {
  const entries: LockfileEntry[] = [];
  const contentHashes: string[] = [];

  // Compute dual hashes for plugs (Plugs system)
  let dualHashResult: ReturnType<typeof computeDualHash> | undefined;
  if (align.plugs) {
    dualHashResult = computeDualHash(align);
  }

  // Compute overlay hash if overlays present (Overlays system)
  const overlayHash =
    overlays && overlays.length > 0 ? computeOverlayHash(overlays) : undefined;

  // Defensive: ensure sections exists
  ensureSectionsArray(align, { throwOnInvalid: true });

  // Filter to only team-scoped sections (exclude personal sections from lockfile)
  const teamSections = align.sections.filter(
    (section) => section.scope !== "personal",
  );

  // Track personal sections count for metadata
  const personalSectionsCount = align.sections.length - teamSections.length;

  // Generate entries from team sections using fingerprints
  for (const section of teamSections) {
    const resultHash = hashSection(section);

    // Compute base hash if base align provided (Overlays system)
    let baseHash: string | undefined;
    if (baseAlign) {
      const baseSection = baseAlign.sections.find(
        (s) => s.fingerprint === section.fingerprint,
      );
      if (baseSection) {
        baseHash = hashSection(baseSection);
      }
    }

    const entry: LockfileEntry = {
      rule_id: section.fingerprint, // Use fingerprint as ID for sections
      content_hash: resultHash, // Alias to result_hash for backward compatibility
      ...(align.owner && { owner: align.owner }),
      ...(align.source && { source: align.source }),
      ...(align.source_sha && { source_sha: align.source_sha }),
      // Triple-hash format when overlays present (Overlays system)
      ...(baseHash && { base_hash: baseHash }),
      ...(overlayHash && { overlay_hash: overlayHash }),
      ...(overlayHash && { result_hash: resultHash }),
      // Team mode: Capture vendoring provenance
      ...(align.vendor_path && { vendor_path: align.vendor_path }),
      ...(align.vendor_type && { vendor_type: align.vendor_type }),
    };

    // Add plugs hashes if align has plugs (Plugs system)
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
 * Compute fingerprint from a RuleFile
 * Matches the logic in ir-loader.ts and source-resolver.ts
 * Uses frontmatter.id if specified, otherwise filename without .md extension
 */
function computeRuleFingerprint(rule: RuleFile): string {
  const frontmatter = rule.frontmatter as Record<string, unknown>;
  return (frontmatter["id"] as string) || rule.filename.replace(/\.md$/, "");
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
    // Use fingerprint (matching ir-loader.ts and source-resolver.ts) as ID
    const fingerprint = computeRuleFingerprint(rule);
    const entry: LockfileEntry = {
      rule_id: fingerprint,
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
 *
 * Excludes source_file from hash since it varies based on working directory
 * and is metadata, not content.
 */
export function hashSection(section: AlignSection): string {
  // Create a copy without source_file to ensure consistent hashing
  // regardless of working directory
  const { source_file: _sourceFile, ...sectionWithoutPath } = section;
  return computeContentHash(sectionWithoutPath, true);
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
