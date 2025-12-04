/**
 * Configuration management for AlignTrue
 * Handles loading, saving, and validating configuration files.
 */

import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from "fs";
import { dirname } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getAlignTruePaths } from "../paths.js";
import type { AlignTrueConfig } from "./types.js";
import {
  validateConfig as validateConfigLogic,
  validateConfigSchema,
  formatConfigValidationErrors,
  applyDefaults as applyDefaultsLogic,
  expandSourcesWithInclude,
} from "../validation/config.js";

// Re-export types
export * from "./types.js";

// Re-export merge functions for two-file config system
export {
  TEAM_MODE_OFF_MARKER,
  FIELD_OWNERSHIP,
  getFieldOwnership,
  isTeamModeActive,
  hasTeamModeOffMarker,
  isLegacyTeamConfig,
  mergeConfigs,
  loadMergedConfig,
  getConfigSource,
  type FieldOwnership,
  type ConfigMergeResult,
  type ConfigSources,
  type ConfigWarning,
} from "./merge.js";

// Re-export ExporterFormat from plugin-contracts for convenience
export type { ExporterFormat } from "@aligntrue/plugin-contracts";

import type { ExporterConfig } from "./types.js";

/**
 * Normalize exporter configuration to object format
 *
 * Converts string array format to object format with empty config.
 * @example
 * // Input: ["cursor", "claude"]
 * // Output: { cursor: {}, claude: {} }
 *
 * // Input: { cursor: { format: "native" }, claude: {} }
 * // Output: { cursor: { format: "native" }, claude: {} }
 */
export function normalizeExporterConfig(
  exporters: string[] | Record<string, ExporterConfig> | undefined,
): Record<string, ExporterConfig> {
  if (!exporters) {
    return {};
  }

  if (Array.isArray(exporters)) {
    return Object.fromEntries(exporters.map((name) => [name, {}]));
  }

  return exporters;
}

/**
 * Get list of exporter names from config (handles both array and object formats)
 */
export function getExporterNames(
  exporters: string[] | Record<string, ExporterConfig> | undefined,
): string[] {
  if (!exporters) {
    return [];
  }

  if (Array.isArray(exporters)) {
    return exporters;
  }

  return Object.keys(exporters);
}

// Re-export validation functions for backward compatibility
export {
  validateConfig,
  validateConfigSchema,
  formatConfigValidationErrors,
  applyDefaults,
  getModeHints,
  isValidConfigKey,
  checkUnknownFields,
  resetShownWarnings,
} from "../validation/config.js";

/**
 * Load and parse config file
 */
export async function loadConfig(
  configPath?: string,
  cwd?: string,
): Promise<AlignTrueConfig> {
  const paths = getAlignTruePaths(cwd);
  const path = configPath || paths.config;

  // Check file exists
  // Safe: Path is typically from getAlignTruePaths().config (safe internal path) or validated user input from CLI
  if (!existsSync(path)) {
    throw new Error(
      `Config file not found: ${path}\n` +
        `  Run 'aligntrue init' to create one.`,
    );
  }

  // Parse YAML
  let content: string;
  let config: unknown;

  try {
    // Safe: Path is typically from getAlignTruePaths().config (safe internal path) or validated user input from CLI
    content = readFileSync(path, "utf8");
  } catch (_err) {
    throw new Error(
      `Failed to read config file: ${path}\n` +
        `  ${_err instanceof Error ? _err.message : String(_err)}`,
    );
  }

  try {
    config = parseYaml(content);
  } catch (_err) {
    const yamlErr = _err as { mark?: { line?: number; column?: number } };
    const location = yamlErr.mark
      ? ` at line ${yamlErr.mark.line! + 1}, column ${yamlErr.mark.column! + 1}`
      : "";

    throw new Error(
      `Invalid YAML in ${path}${location}\n` +
        `  ${_err instanceof Error ? _err.message : String(_err)}\n` +
        `  Check for syntax errors (indentation, quotes, colons).`,
    );
  }

  // Validate against JSON Schema
  const schemaValidation = validateConfigSchema(config);
  if (!schemaValidation.valid) {
    throw new Error(
      `Invalid config in ${path}:\n${formatConfigValidationErrors(schemaValidation.errors)}\n` +
        `  See config.schema.json for full specification.`,
    );
  }

  // Cast to config type (safe after schema validation)
  const typedConfig = config as AlignTrueConfig;

  // Apply defaults
  const configWithDefaults = applyDefaultsLogic(typedConfig);

  // Expand sources with include syntax before validation
  if (configWithDefaults.sources && configWithDefaults.sources.length > 0) {
    configWithDefaults.sources = expandSourcesWithInclude(
      configWithDefaults.sources,
    );
  }

  // Run enhanced validation (scopes, paths, cross-field checks)
  await validateConfigLogic(configWithDefaults, path);

  return configWithDefaults;
}

/**
 * Save config to file with atomic write
 */
export async function saveConfig(
  config: AlignTrueConfig,
  configPath?: string,
  cwd?: string,
): Promise<void> {
  const paths = getAlignTruePaths(cwd);
  const path = configPath || paths.config;
  const yamlContent = stringifyYaml(config);
  const tempPath = `${path}.tmp`;

  // Ensure directory exists
  // Safe: Path is typically from getAlignTruePaths().config (safe internal path) or validated user input from CLI
  mkdirSync(dirname(path), { recursive: true });

  // Write to temp file first
  // Safe: Temp path derived from config path (typically from getAlignTruePaths().config)
  writeFileSync(tempPath, yamlContent, "utf-8");

  // Rename atomically (overwrites destination)
  // Safe: Path is typically from getAlignTruePaths().config (safe internal path) or validated user input from CLI
  renameSync(tempPath, path);
}

/**
 * Deep merge updates into existing config object.
 * - Objects are recursively merged (updates override existing keys)
 * - Arrays and primitives are replaced entirely
 * - Only keys present in updates are modified; other keys are preserved
 * - null values delete the key entirely
 * - undefined values are skipped (key not modified)
 */
function deepMergeUpdates(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...existing };

  for (const key of Object.keys(updates)) {
    const updateValue = updates[key];
    const existingValue = existing[key];

    // If update value is undefined, skip (don't delete keys)
    if (updateValue === undefined) {
      continue;
    }

    // If update value is null, delete the key entirely
    if (updateValue === null) {
      delete result[key];
      continue;
    }

    // If both are plain objects (not arrays), recursively merge
    if (
      typeof updateValue === "object" &&
      !Array.isArray(updateValue) &&
      typeof existingValue === "object" &&
      existingValue !== null &&
      !Array.isArray(existingValue)
    ) {
      result[key] = deepMergeUpdates(
        existingValue as Record<string, unknown>,
        updateValue as Record<string, unknown>,
      );
    } else {
      // Arrays and primitives: replace entirely
      result[key] = updateValue;
    }
  }

  return result;
}

/**
 * Patch config file with surgical updates.
 *
 * Only modifies the specific keys provided in updates - all other
 * existing configuration is preserved exactly as written by the user.
 *
 * Use this for CLI commands that add/update specific config sections
 * (e.g., add remote, add source, enable exporter).
 *
 * @param updates - Partial config with only the keys to update
 * @param configPath - Path to config file (defaults to .aligntrue/config.yaml)
 * @param cwd - Working directory
 */
export async function patchConfig(
  updates: Partial<AlignTrueConfig>,
  configPath?: string,
  cwd?: string,
): Promise<void> {
  const paths = getAlignTruePaths(cwd);
  const path = configPath || paths.config;

  // Read existing file content (raw, without applying defaults)
  let existing: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      const content = readFileSync(path, "utf-8");
      existing = (parseYaml(content) as Record<string, unknown>) || {};
    } catch {
      // If file exists but can't be parsed, start fresh
      existing = {};
    }
  }

  // Deep merge updates into existing config
  const merged = deepMergeUpdates(existing, updates as Record<string, unknown>);

  // Write back with atomic write
  const yamlContent = stringifyYaml(merged);
  const tempPath = `${path}.tmp`;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tempPath, yamlContent, "utf-8");
  renameSync(tempPath, path);
}
