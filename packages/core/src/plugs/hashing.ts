/**
 * Dual hashing for plugs: pre-resolution (lock) + post-resolution (export)
 *
 * Pre-resolution hash: Used in lockfile for content verification (deterministic)
 * Post-resolution hash: Used in export for integrity (includes resolved text)
 */

import type { Align } from "@aligntrue/schema";
import { computeHash, cloneDeep } from "@aligntrue/schema";
import { resolvePlugsForAlign } from "./index.js";

/**
 * Compute pre-resolution hash for an align align
 *
 * This hash is deterministic and used for lockfile verification.
 * It's computed BEFORE plug resolution, so it represents the template.
 *
 * @param align - Align align to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function computePreResolutionHash(align: Align): string {
  // Create a copy to avoid modifying original
  const alignCopy = cloneDeep(align);

  // For pre-resolution hash, we want to hash the template with [[plug:key]] placeholders intact
  // This makes the hash deterministic regardless of fill values

  // Remove volatile fields that shouldn't affect hash
  if (alignCopy._markdown_meta) {
    delete alignCopy._markdown_meta;
  }

  // Remove fills from pre-resolution hash (we only want the template)
  if (alignCopy.plugs && alignCopy.plugs.fills) {
    delete alignCopy.plugs.fills;
  }

  // Use stringify without key sorting (the content itself should be deterministic)
  const canonical = JSON.stringify(alignCopy);

  return computeHash(canonical);
}

/**
 * Compute post-resolution hash for an align align
 *
 * This hash includes resolved plug values and is used for export integrity.
 * It changes when fill values change.
 *
 * @param align - Align align to hash
 * @returns Hex-encoded SHA-256 hash, or undefined if resolution failed
 */
export function computePostResolutionHash(align: Align): string | undefined {
  // Resolve plugs first
  const resolveResult = resolvePlugsForAlign(align);

  if (!resolveResult.success) {
    return undefined;
  }

  // Create a copy with resolved content
  const alignCopy = cloneDeep(align) as unknown as Record<string, unknown>;

  // Update sections with resolved content
  for (const resolvedRule of resolveResult.rules) {
    const sections = alignCopy["sections"] as Array<Record<string, unknown>>;
    const section = sections?.find?.(
      (s) => s["fingerprint"] === resolvedRule.ruleId,
    );
    if (section && resolvedRule.content) {
      section["content"] = resolvedRule.content;
    }
  }

  // Remove volatile fields
  if (alignCopy["_markdown_meta"]) {
    delete alignCopy["_markdown_meta"];
  }

  // Use stringify without key sorting (the content itself should be deterministic)
  const canonical = JSON.stringify(alignCopy);

  return computeHash(canonical);
}

/**
 * Result of dual hashing
 */
export interface DualHashResult {
  preResolutionHash: string; // Hash before resolution (for lockfile)
  postResolutionHash?: string; // Hash after resolution (for export, undefined if resolution failed)
  unresolvedRequired: string[]; // List of unresolved required plugs
}

/**
 * Compute both pre and post resolution hashes
 *
 * @param align - Align align to hash
 * @returns Dual hash result
 */
export function computeDualHash(align: Align): DualHashResult {
  const preResolutionHash = computePreResolutionHash(align);
  const postResolutionHash = computePostResolutionHash(align);

  // Get unresolved plugs list
  const resolveResult = resolvePlugsForAlign(align);
  const unresolvedRequired = resolveResult.unresolvedRequired || [];

  const result: DualHashResult = {
    preResolutionHash,
    unresolvedRequired,
  };

  if (postResolutionHash) {
    result.postResolutionHash = postResolutionHash;
  }

  return result;
}
