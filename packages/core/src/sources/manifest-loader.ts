/**
 * Align Manifest Loader
 *
 * Detects and processes .align.yaml manifest files that define curated bundles
 * of rules and configurations for sharing.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname, basename } from "path";
import { parse as parseYaml } from "yaml";
import type { AlignManifest, AlignCustomization } from "@aligntrue/schema";

/**
 * Result of loading an align manifest
 */
export interface ManifestLoadResult {
  /** The parsed manifest */
  manifest: AlignManifest;
  /** Base directory for resolving relative paths */
  baseDir: string;
  /** Resolved rule file paths */
  resolvedRules: string[];
  /** Any warnings during loading */
  warnings: string[];
}

/**
 * Options for loading manifests
 */
export interface ManifestLoadOptions {
  /** Whether to apply author customizations (default: true) */
  applyCustomizations?: boolean;
  /** Base directory override for resolving relative paths */
  baseDir?: string;
}

/**
 * Check if a path points to an align manifest file
 */
export function isAlignManifest(path: string): boolean {
  const filename = basename(path);
  return filename.endsWith(".align.yaml") || filename.endsWith(".align.yml");
}

/**
 * Load an align manifest from a file path
 */
export function loadManifest(
  manifestPath: string,
  options: ManifestLoadOptions = {},
): ManifestLoadResult {
  const warnings: string[] = [];

  if (!existsSync(manifestPath)) {
    throw new Error(
      `Align manifest not found\n` +
        `  Path: ${manifestPath}\n` +
        `  Expected a .align.yaml file`,
    );
  }

  // Read and parse manifest
  const content = readFileSync(manifestPath, "utf-8");
  let manifest: AlignManifest;

  try {
    manifest = parseYaml(content) as AlignManifest;
  } catch (error) {
    throw new Error(
      `Failed to parse align manifest\n` +
        `  Path: ${manifestPath}\n` +
        `  ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Validate required fields
  if (!manifest.id) {
    throw new Error(
      `Align manifest missing required 'id' field\n` +
        `  Path: ${manifestPath}\n` +
        `  Expected: id in author/name format (e.g., 'aligntrue/typescript-starter')`,
    );
  }

  if (!manifest.version) {
    throw new Error(
      `Align manifest missing required 'version' field\n` +
        `  Path: ${manifestPath}\n` +
        `  Expected: semantic version (e.g., '1.0.0')`,
    );
  }

  // Validate id format
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(manifest.id)) {
    warnings.push(
      `Align manifest id '${manifest.id}' does not match recommended format (author/name)`,
    );
  }

  // Determine base directory for resolving relative paths
  const baseDir = options.baseDir ?? dirname(manifestPath);

  // Resolve rule file paths
  const resolvedRules: string[] = [];

  if (manifest.includes?.rules) {
    for (const rulePath of manifest.includes.rules) {
      const resolvedPath = join(baseDir, rulePath);

      if (!existsSync(resolvedPath)) {
        warnings.push(
          `Rule file not found: ${rulePath} (resolved to ${resolvedPath})`,
        );
      } else {
        resolvedRules.push(resolvedPath);
      }
    }
  }

  return {
    manifest,
    baseDir,
    resolvedRules,
    warnings,
  };
}

/**
 * Get customizations for a specific file from a manifest
 */
export function getFileCustomizations(
  manifest: AlignManifest,
  filePath: string,
): AlignCustomization | undefined {
  if (!manifest.customizations) {
    return undefined;
  }

  // Try exact match first
  if (manifest.customizations[filePath]) {
    return manifest.customizations[filePath];
  }

  // Try with leading ./
  if (manifest.customizations[`./${filePath}`]) {
    return manifest.customizations[`./${filePath}`];
  }

  // Try without leading ./
  const withoutPrefix = filePath.replace(/^\.\//, "");
  if (manifest.customizations[withoutPrefix]) {
    return manifest.customizations[withoutPrefix];
  }

  return undefined;
}

/**
 * Apply customizations to rule frontmatter
 *
 * Merges author-recommended customizations with existing frontmatter.
 * Consumer overrides take precedence over author customizations.
 */
export function applyCustomizations(
  frontmatter: Record<string, unknown>,
  customization: AlignCustomization,
  consumerOverrides?: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...frontmatter };

  // Apply author customizations (lower priority)
  if (customization.frontmatter) {
    for (const [key, value] of Object.entries(customization.frontmatter)) {
      if (!(key in result)) {
        result[key] = value;
      }
    }
  }

  // Apply consumer overrides (highest priority)
  if (consumerOverrides) {
    for (const [key, value] of Object.entries(consumerOverrides)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Apply plug customizations
 *
 * Merges author-recommended plug fills with existing fills.
 * Consumer fills take precedence over author fills.
 */
export function applyPlugCustomizations(
  existingFills: Record<string, string>,
  customization: AlignCustomization,
  consumerFills?: Record<string, string>,
): Record<string, string> {
  const result = { ...existingFills };

  // Apply author customizations (lower priority)
  if (customization.plugs) {
    for (const [key, value] of Object.entries(customization.plugs)) {
      if (!(key in result) && typeof value === "string") {
        result[key] = value;
      }
    }
  }

  // Apply consumer fills (highest priority)
  if (consumerFills) {
    for (const [key, value] of Object.entries(consumerFills)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Result of parsing an align URL
 */
export interface ParsedAlignUrl {
  baseUrl: string;
  applyCustomizations: boolean;
  ref: string | undefined;
}

/**
 * Parse a URL with optional query parameters for customization control
 *
 * Supports:
 * - ?customizations=false - Disable author customizations
 * - ?ref=v1.0.0 - Specify version/ref
 */
export function parseAlignUrl(url: string): ParsedAlignUrl {
  try {
    const parsed = new URL(url);
    const applyCustomizations =
      parsed.searchParams.get("customizations") !== "false";
    const ref = parsed.searchParams.get("ref") ?? undefined;

    // Remove query params from base URL
    parsed.search = "";
    const baseUrl = parsed.toString();

    return { baseUrl, applyCustomizations, ref };
  } catch {
    // Not a valid URL, return as-is
    return { baseUrl: url, applyCustomizations: true, ref: undefined };
  }
}
