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

  // Build sync section only if there are non-default values
  const syncSection: Partial<typeof config.sync> = {};
  let hasSyncChanges = false;

  if (config.sync?.source_markers !== undefined) {
    syncSection.source_markers = config.sync.source_markers;
    hasSyncChanges = true;
  }
  if (config.sync?.content_mode !== undefined) {
    syncSection.content_mode = config.sync.content_mode;
    hasSyncChanges = true;
  }
  if (config.sync?.auto_manage_ignore_files !== undefined) {
    syncSection.auto_manage_ignore_files = config.sync.auto_manage_ignore_files;
    hasSyncChanges = true;
  }
  if (config.sync?.ignore_file_priority !== undefined) {
    syncSection.ignore_file_priority = config.sync.ignore_file_priority;
    hasSyncChanges = true;
  }
  if (
    config.sync?.custom_format_priority !== undefined &&
    Object.keys(config.sync.custom_format_priority).length > 0
  ) {
    syncSection.custom_format_priority = config.sync.custom_format_priority;
    hasSyncChanges = true;
  }
  if (config.sync?.cleanup !== undefined) {
    syncSection.cleanup = config.sync.cleanup;
    hasSyncChanges = true;
  }

  if (hasSyncChanges) {
    minimalConfig.sync = syncSection;
  }

  // Sources: only if not default (now defaults to rules directory)
  const defaultSources = JSON.stringify([
    { type: "local", path: ".aligntrue/rules" },
  ]);
  const currentSources = JSON.stringify(config.sources);
  if (currentSources !== defaultSources && config.sources !== undefined) {
    minimalConfig.sources = config.sources;
  }

  // Scopes: always include if present (not defaults)
  if (config.scopes && config.scopes.length > 0) {
    minimalConfig.scopes = config.scopes;
  }

  // Overlays: preserve if present with overrides or limits (user-configured)
  if (config.overlays) {
    const hasOverrides =
      Array.isArray(config.overlays.overrides) &&
      config.overlays.overrides.length > 0;
    const hasLimits = config.overlays.limits !== undefined;
    if (hasOverrides || hasLimits) {
      minimalConfig.overlays = config.overlays;
    }
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

  // Remotes: always preserve if present (user-configured, no defaults)
  if (config.remotes) {
    const hasRemotes =
      config.remotes.personal !== undefined ||
      config.remotes.shared !== undefined ||
      (config.remotes.custom && config.remotes.custom.length > 0);
    if (hasRemotes) {
      minimalConfig.remotes = config.remotes;
    }
  }

  // Plugs: always preserve if present (user-configured fills)
  if (config.plugs?.fills && Object.keys(config.plugs.fills).length > 0) {
    minimalConfig.plugs = config.plugs;
  }

  // MCP: always preserve if present (user-configured servers)
  if (config.mcp?.servers && config.mcp.servers.length > 0) {
    minimalConfig.mcp = config.mcp;
  }

  // Merge: always preserve if present (user-configured)
  if (config.merge) {
    const hasMergeConfig =
      config.merge.strategy !== undefined || config.merge.order !== undefined;
    if (hasMergeConfig) {
      minimalConfig.merge = config.merge;
    }
  }

  // Export: always preserve if present (user-configured mode hints)
  if (config.export) {
    const hasExportConfig =
      config.export.mode_hints !== undefined ||
      config.export.max_hint_blocks !== undefined ||
      config.export.max_hint_tokens !== undefined;
    if (hasExportConfig) {
      minimalConfig.export = config.export;
    }
  }

  // Git: preserve non-default values
  const gitSection: Partial<NonNullable<typeof config.git>> = {};
  let hasGitChanges = false;

  if (config.git?.mode && config.git.mode !== defaults.git?.mode) {
    gitSection.mode = config.git.mode;
    hasGitChanges = true;
  }
  if (
    config.git?.per_exporter &&
    Object.keys(config.git.per_exporter).length > 0
  ) {
    gitSection.per_exporter = config.git.per_exporter;
    hasGitChanges = true;
  }
  if (config.git?.auto_gitignore && config.git.auto_gitignore !== "auto") {
    gitSection.auto_gitignore = config.git.auto_gitignore;
    hasGitChanges = true;
  }

  if (hasGitChanges) {
    minimalConfig.git = gitSection;
  }

  // Remote backup (deprecated): preserve if present for backwards compat
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (config.remote_backup) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    minimalConfig.remote_backup = config.remote_backup;
  }

  const yamlContent = stringifyYaml(minimalConfig);
  const tempPath = `${path}.tmp`;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tempPath, yamlContent, "utf-8");
  renameSync(tempPath, path);
}

/**
 * Auto-select save mode based on config mode
 *
 * - Solo mode: Use minimal save to keep config clean and readable
 * - Team/Enterprise mode: Use full save for explicit configuration
 *
 * Use this in CLI commands to ensure correct save behavior.
 */
export async function saveConfigAuto(
  config: AlignTrueConfig,
  configPath?: string,
  cwd?: string,
): Promise<void> {
  if (config.mode === "solo") {
    return saveMinimalConfig(config, configPath, cwd);
  }
  return saveConfig(config, configPath, cwd);
}
