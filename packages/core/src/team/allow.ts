/**
 * Allow list management for team mode
 *
 * Phase 3: Git-based source resolution only
 * Phase 4: Add catalog API resolution as primary source
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { dirname } from "path";
import { mkdirSync } from "fs";
import type {
  AllowList,
  AllowListSource,
  SourceResolutionResult,
  AllowListValidationResult,
  ParsedSourceId,
} from "./types.js";

/**
 * Parse and load allow list from file
 */
export function parseAllowList(path: string): AllowList {
  if (!existsSync(path)) {
    // Return empty allow list if file doesn't exist
    return { version: 1, sources: [] };
  }

  const content = readFileSync(path, "utf-8");
  const parsed = parseYaml(content);

  // Basic validation
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid allow list: must be a YAML object");
  }

  if (!("version" in parsed) || parsed.version !== 1) {
    throw new Error("Invalid allow list: version must be 1");
  }

  if (!("sources" in parsed) || !Array.isArray(parsed.sources)) {
    throw new Error("Invalid allow list: sources must be an array");
  }

  return parsed as AllowList;
}

/**
 * Validate allow list schema
 */
export function validateAllowList(list: AllowList): AllowListValidationResult {
  const errors: string[] = [];

  if (list.version !== 1) {
    errors.push("version must be 1");
  }

  if (!Array.isArray(list.sources)) {
    errors.push("sources must be an array");
    return { valid: false, errors };
  }

  list.sources.forEach((source, idx) => {
    if (!source.type || !["id", "hash"].includes(source.type)) {
      errors.push(`sources[${idx}].type must be 'id' or 'hash'`);
    }

    if (!source.value || typeof source.value !== "string") {
      errors.push(`sources[${idx}].value must be a non-empty string`);
    }

    if (
      source.type === "hash" &&
      source.value &&
      !source.value.startsWith("sha256:")
    ) {
      errors.push(
        `sources[${idx}].value must start with 'sha256:' when type is 'hash'`,
      );
    }

    if (source.resolved_hash && typeof source.resolved_hash !== "string") {
      errors.push(`sources[${idx}].resolved_hash must be a string`);
    }

    if (source.comment && typeof source.comment !== "string") {
      errors.push(`sources[${idx}].comment must be a string`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Parse id@profile@version format
 */
export function parseSourceId(source: string): ParsedSourceId | null {
  // Format: id@profile@version
  // Example: base-global@aligntrue/catalog@v1.0.0
  const parts = source.split("@");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  return {
    id: parts[0],
    profile: parts[1],
    version: parts[2],
  };
}

/**
 * Resolve source to concrete hash
 *
 * Phase 3: Git-only resolution
 * Phase 4: TODO: Add catalog API resolution as primary source
 */
export async function resolveSource(
  source: string,
): Promise<SourceResolutionResult> {
  // If already a hash, no resolution needed
  if (source.startsWith("sha256:")) {
    return {
      success: true,
      source,
      hash: source,
    };
  }

  // Parse id@profile@version format
  const parsed = parseSourceId(source);
  if (!parsed) {
    return {
      success: false,
      source,
      error:
        "Invalid source format. Expected: id@profile@version or sha256:...",
    };
  }

  try {
    // Phase 3: Git resolution only
    // TODO Phase 4: Try catalog API first, fall back to git
    const hash = await resolveSourceViaGit(parsed);

    return {
      success: true,
      source,
      hash,
    };
  } catch (_err) {
    return {
      success: false,
      source,
      error: _err instanceof Error ? _err.message : String(_err),
    };
  }
}

/**
 * Resolve source via git clone and hash computation
 *
 * Phase 3: Main resolution path
 * Phase 4: Fallback when catalog API unavailable
 */
async function resolveSourceViaGit(parsed: ParsedSourceId): Promise<string> {
  // TODO: Implement git-based resolution
  // 1. Use existing git provider from Phase 2 to clone repo
  // 2. Checkout specified version (tag/branch)
  // 3. Compute hash of pack content
  // 4. Return sha256:... hash

  // For now, throw to indicate not yet implemented
  throw new Error(
    `Git resolution not yet implemented. Parsed: ${JSON.stringify(parsed)}`,
  );
}

/**
 * Check if source is allowed in the allow list
 */
export function isSourceAllowed(source: string, allowList: AllowList): boolean {
  // Check direct hash match
  if (source.startsWith("sha256:")) {
    return allowList.sources.some(
      (s) => s.value === source || s.resolved_hash === source,
    );
  }

  // Check id@version match
  return allowList.sources.some(
    (s) => s.value === source || (s.type === "id" && s.value === source),
  );
}

/**
 * Add source to allow list (with resolution)
 */
export async function addSourceToAllowList(
  source: string,
  allowList: AllowList,
): Promise<AllowList> {
  // Check if already present
  if (isSourceAllowed(source, allowList)) {
    return allowList;
  }

  // Resolve source to get hash
  const result = await resolveSource(source);
  if (!result.success) {
    throw new Error(`Failed to resolve source: ${result.error}`);
  }

  // Determine type
  const type = source.startsWith("sha256:") ? "hash" : "id";

  // Add to sources
  const newSource: AllowListSource = {
    type,
    value: source,
  };

  if (type === "id" && result.hash) {
    newSource.resolved_hash = result.hash;
  }

  return {
    ...allowList,
    sources: [...allowList.sources, newSource],
  };
}

/**
 * Remove source from allow list
 */
export function removeSourceFromAllowList(
  source: string,
  allowList: AllowList,
): AllowList {
  const sources = allowList.sources.filter(
    (s) => s.value !== source && s.resolved_hash !== source,
  );

  return {
    ...allowList,
    sources,
  };
}

/**
 * Write allow list to file
 */
export function writeAllowList(path: string, allowList: AllowList): void {
  const content = stringifyYaml(allowList);

  // Ensure directory exists
  mkdirSync(dirname(path), { recursive: true });

  writeFileSync(path, content, "utf-8");
}
