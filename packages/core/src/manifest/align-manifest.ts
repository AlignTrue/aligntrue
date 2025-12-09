import { parse as parseYaml } from "yaml";
import { isValidManifestId, type AlignManifest } from "@aligntrue/schema";

export interface AlignManifestParseOptions {
  /**
   * Path or identifier used only for clearer error messages.
   */
  manifestPath?: string;
}

export interface AlignManifestParseResult {
  manifest: AlignManifest;
  warnings: string[];
}

/**
 * Parse and validate the contents of a `.align.yaml` manifest.
 *
 * - Ensures required fields are present (id, version)
 * - Validates recommended id format (author/name)
 * - Returns warnings for soft issues (non-standard id)
 */
export function parseAlignManifest(
  content: string,
  options: AlignManifestParseOptions = {},
): AlignManifestParseResult {
  const warnings: string[] = [];
  const label = options.manifestPath
    ? `\n  Manifest: ${options.manifestPath}`
    : "";

  if (!content || !content.trim()) {
    throw new Error(
      `Align manifest is empty. Add id, version, and includes.${label}`,
    );
  }

  let manifest: AlignManifest;
  try {
    manifest = parseYaml(content) as AlignManifest;
  } catch (error) {
    throw new Error(
      `Failed to parse align manifest${label}\n` +
        `  ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!manifest || typeof manifest !== "object") {
    throw new Error(
      `Align manifest must be a YAML object with required fields.${label}`,
    );
  }

  if (!manifest.id) {
    throw new Error(
      `Align manifest missing required 'id'. Expected author/name.${label}`,
    );
  }

  if (!isValidManifestId(manifest.id)) {
    warnings.push(
      `Manifest id '${manifest.id}' is non-standard. Recommended author/name (lowercase, hyphens).`,
    );
  }

  if (!manifest.version) {
    throw new Error(
      `Align manifest missing required 'version'. Expected semver (e.g., 1.0.0).${label}`,
    );
  }

  // Normalize includes to avoid undefined checks downstream
  const normalizedIncludes: AlignManifest["includes"] = manifest.includes
    ? {
        ...(manifest.includes.rules &&
          manifest.includes.rules.length > 0 && {
            rules: [...manifest.includes.rules],
          }),
        ...(manifest.includes.skills &&
          manifest.includes.skills.length > 0 && {
            skills: [...manifest.includes.skills],
          }),
        ...(manifest.includes.mcp &&
          manifest.includes.mcp.length > 0 && {
            mcp: [...manifest.includes.mcp],
          }),
      }
    : undefined;

  const normalized: AlignManifest = {
    ...manifest,
    ...(normalizedIncludes ? { includes: normalizedIncludes } : {}),
    ...(manifest.customizations
      ? { customizations: { ...manifest.customizations } }
      : {}),
    ...(manifest.defaults ? { defaults: { ...manifest.defaults } } : {}),
  };

  return { manifest: normalized, warnings };
}
