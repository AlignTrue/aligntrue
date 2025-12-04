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
 * Save config to file with minimal output (only non-default values)
 * Use for solo mode where clean, readable configs matter
 */
export async function saveMinimalConfig(
  config: AlignTrueConfig,
  configPath?: string,
  cwd?: string,
): Promise<void> {
  const paths = getAlignTruePaths(cwd);
  const path = configPath || paths.config;

  // Create minimal config by comparing against defaults
  const minimalConfig: Partial<AlignTrueConfig> = {};

  // Always include exporters (required field)
  const exporterCount = getExporterNames(config.exporters).length;
  if (config.exporters && exporterCount > 0) {
    minimalConfig.exporters = config.exporters;
  }

  // Only add fields that differ from defaults
  // Use same mode as config to get correct mode-specific defaults
  const defaults = applyDefaultsLogic({
    exporters: config.exporters || [],
    mode: config.mode,
    version: config.version,
  });

  // Mode: only if not solo (solo is default)
  if (config.mode && config.mode !== "solo") {
    minimalConfig.mode = config.mode;
  }

  // Version: only if not "1"
  if (config.version && config.version !== "1") {
    minimalConfig.version = config.version;
  }

  // Modules: only non-default values
  if (config.modules) {
    const hasNonDefaults =
      config.modules.lockfile !== defaults.modules?.lockfile ||
      config.modules.bundle !== defaults.modules?.bundle ||
      config.modules.checks !== defaults.modules?.checks ||
      config.modules.mcp !== defaults.modules?.mcp;

    if (hasNonDefaults) {
      minimalConfig.modules = {};
      if (
        config.modules.lockfile !== defaults.modules?.lockfile &&
        config.modules.lockfile !== undefined
      ) {
        minimalConfig.modules.lockfile = config.modules.lockfile;
      }
      if (
        config.modules.bundle !== defaults.modules?.bundle &&
        config.modules.bundle !== undefined
      ) {
        minimalConfig.modules.bundle = config.modules.bundle;
      }
      if (
        config.modules.checks !== defaults.modules?.checks &&
        config.modules.checks !== undefined
      ) {
        minimalConfig.modules.checks = config.modules.checks;
      }
      if (
        config.modules.mcp !== defaults.modules?.mcp &&
        config.modules.mcp !== undefined
      ) {
        minimalConfig.modules.mcp = config.modules.mcp;
      }
    }
  }

  // Only include other sections if they have non-default values
  if (
    config.lockfile?.mode &&
    config.lockfile.mode !== defaults.lockfile?.mode
  ) {
    minimalConfig.lockfile = { mode: config.lockfile.mode };
  }

  // Note: sync section serialization has been removed (watch mode deprecated)

  // Sources: only if not default (now defaults to rules directory)
  const defaultSources = JSON.stringify([
    { type: "local", path: ".aligntrue/rules" },
  ]);
  const currentSources = JSON.stringify(config.sources);
  if (currentSources !== defaultSources && config.sources !== undefined) {
    minimalConfig.sources = config.sources;
  }

  // Scopes, overlays: always include if present (not defaults)
  if (config.scopes && config.scopes.length > 0) {
    minimalConfig.scopes = config.scopes;
  }
  if (
    config.overlays &&
    Array.isArray(config.overlays) &&
    config.overlays.length > 0
  ) {
    minimalConfig.overlays = config.overlays;
  }

  // Detection: include if non-default values
  const detectionSection: Partial<typeof config.detection> = {};
  let hasDetectionChanges = false;

  if (
    config.detection?.auto_enable !== defaults.detection?.auto_enable &&
    config.detection?.auto_enable !== undefined
  ) {
    detectionSection.auto_enable = config.detection.auto_enable;
    hasDetectionChanges = true;
  }
  if (
    config.detection?.ignored_agents &&
    config.detection.ignored_agents.length > 0
  ) {
    detectionSection.ignored_agents = config.detection.ignored_agents;
    hasDetectionChanges = true;
  }

  if (hasDetectionChanges) {
    minimalConfig.detection = detectionSection;
  }

  const yamlContent = stringifyYaml(minimalConfig);
  const tempPath = `${path}.tmp`;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tempPath, yamlContent, "utf-8");
  renameSync(tempPath, path);
}
