/**
 * Configuration merging for AlignTrue two-file config system
 *
 * Handles merging personal config (config.yaml) with team config (config.team.yaml)
 * using defined field ownership rules.
 */

import { readFileSync, existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import { getAlignTruePaths } from "../paths.js";
import type {
  AlignTrueConfig,
  RemotesConfig,
  ExporterConfig,
} from "./types.js";
import {
  validateConfigSchema,
  formatConfigValidationErrors,
  applyDefaults,
} from "../validation/config.js";

/**
 * Marker comment for disabled team config.
 * When this line is at the start of config.team.yaml, team mode is considered disabled.
 */
export const TEAM_MODE_OFF_MARKER =
  "# TEAM MODE OFF - This file is ignored. Re-enable with: aligntrue team enable";

/**
 * Field ownership categories for configuration fields.
 * Determines which config file "owns" each field and how conflicts are resolved.
 */
export type FieldOwnership = "team-only" | "personal-only" | "shared";

/**
 * Field ownership rules for configuration fields
 */
export const FIELD_OWNERSHIP: Record<string, FieldOwnership> = {
  // Team-only: These fields only make sense in team config
  mode: "team-only",
  "modules.lockfile": "team-only",
  "modules.bundle": "team-only",
  "lockfile.mode": "team-only",

  // Personal-only: These fields should only be in personal config
  "remotes.personal": "personal-only",

  // Shared: These fields can appear in both and are merged
  version: "shared",
  sources: "shared",
  exporters: "shared",
  "remotes.shared": "shared",
  "remotes.custom": "shared",
  git: "shared",
  overlays: "shared",
  scopes: "shared",
  merge: "shared",
  performance: "shared",
  export: "shared",
  backup: "shared",
  detection: "shared",
  plugs: "shared",
  mcp: "shared",
  sync: "shared",
  "modules.checks": "shared",
  "modules.mcp": "shared",
};

/**
 * Get field ownership for a given field path
 */
export function getFieldOwnership(fieldPath: string): FieldOwnership {
  // Check exact match first
  if (fieldPath in FIELD_OWNERSHIP) {
    return FIELD_OWNERSHIP[fieldPath] as FieldOwnership;
  }

  // Check if parent path has ownership defined
  const parts = fieldPath.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentPath = parts.slice(0, i).join(".");
    if (parentPath in FIELD_OWNERSHIP) {
      return FIELD_OWNERSHIP[parentPath] as FieldOwnership;
    }
  }

  // Default to shared for unknown fields
  return "shared";
}

/**
 * Result of config merge operation with source tracking
 */
export interface ConfigMergeResult {
  config: AlignTrueConfig;
  sources: ConfigSources;
  warnings: ConfigWarning[];
  isTeamMode: boolean;
  isLegacyTeamConfig: boolean;
}

/**
 * Tracks which file each field came from
 */
export interface ConfigSources {
  personal: boolean; // true if personal config exists
  team: boolean; // true if team config is active
  fieldSources: Map<string, "personal" | "team" | "merged">;
}

/**
 * Warning about field ownership violations
 */
export interface ConfigWarning {
  field: string;
  message: string;
  level: "warn" | "info";
}

/**
 * Check if team mode is active based on config.team.yaml
 *
 * Team mode is active when:
 * - config.team.yaml exists AND
 * - Does NOT start with TEAM_MODE_OFF_MARKER
 */
export function isTeamModeActive(cwd: string = process.cwd()): boolean {
  const paths = getAlignTruePaths(cwd);
  const teamConfigPath = paths.teamConfig;

  if (!existsSync(teamConfigPath)) {
    return false;
  }

  try {
    const content = readFileSync(teamConfigPath, "utf-8");
    // Team mode is OFF if file starts with the marker
    return !content.startsWith(TEAM_MODE_OFF_MARKER);
  } catch {
    return false;
  }
}

/**
 * Check if team config file has the OFF marker
 */
export function hasTeamModeOffMarker(cwd: string = process.cwd()): boolean {
  const paths = getAlignTruePaths(cwd);
  const teamConfigPath = paths.teamConfig;

  if (!existsSync(teamConfigPath)) {
    return false;
  }

  try {
    const content = readFileSync(teamConfigPath, "utf-8");
    return content.startsWith(TEAM_MODE_OFF_MARKER);
  } catch {
    return false;
  }
}

/**
 * Check if this is a legacy team config (mode: team in config.yaml, no config.team.yaml)
 */
export function isLegacyTeamConfig(cwd: string = process.cwd()): boolean {
  const paths = getAlignTruePaths(cwd);

  // If team config exists (and is active), it's not legacy
  if (existsSync(paths.teamConfig) && isTeamModeActive(cwd)) {
    return false;
  }

  // Check if personal config has mode: team
  if (!existsSync(paths.config)) {
    return false;
  }

  try {
    const content = readFileSync(paths.config, "utf-8");
    const config = parseYaml(content) as Record<string, unknown>;
    return config?.["mode"] === "team";
  } catch {
    return false;
  }
}

/**
 * Load raw config from a YAML file without validation or defaults
 */
function loadRawConfig(
  configPath: string,
): Record<string, unknown> | undefined {
  if (!existsSync(configPath)) {
    return undefined;
  }

  try {
    const content = readFileSync(configPath, "utf-8");

    // Skip content after TEAM_MODE_OFF_MARKER if present
    let yamlContent = content;
    if (content.startsWith(TEAM_MODE_OFF_MARKER)) {
      // Find the end of the marker line and parse from there
      const markerEnd = content.indexOf("\n");
      if (markerEnd !== -1) {
        yamlContent = content.slice(markerEnd + 1);
      }
    }

    const parsed = parseYaml(yamlContent);
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Merge exporters from personal and team configs
 * Arrays are additive (union)
 */
function mergeExporters(
  personal: string[] | Record<string, ExporterConfig> | undefined,
  team: string[] | Record<string, ExporterConfig> | undefined,
): string[] | Record<string, ExporterConfig> | undefined {
  if (!personal && !team) return undefined;
  if (!team) return personal;
  if (!personal) return team;

  // Normalize both to arrays
  const personalNames = Array.isArray(personal)
    ? personal
    : Object.keys(personal);
  const teamNames = Array.isArray(team) ? team : Object.keys(team);

  // Union of names
  const allNames = [...new Set([...teamNames, ...personalNames])];

  // If either is an object format, preserve configs
  if (!Array.isArray(personal) || !Array.isArray(team)) {
    const personalObj = Array.isArray(personal)
      ? Object.fromEntries(personal.map((n) => [n, {}]))
      : personal;
    const teamObj = Array.isArray(team)
      ? Object.fromEntries(team.map((n) => [n, {}]))
      : team;

    return Object.fromEntries(
      allNames.map((name) => [
        name,
        { ...teamObj[name], ...personalObj[name] },
      ]),
    );
  }

  return allNames;
}

/**
 * Merge sources from personal and team configs
 * Arrays are additive (concatenated)
 */
function mergeSources(
  personal: AlignTrueConfig["sources"],
  team: AlignTrueConfig["sources"],
): AlignTrueConfig["sources"] {
  if (!personal && !team) return undefined;
  if (!team) return personal;
  if (!personal) return team;

  // Team sources first, then personal sources
  return [...team, ...personal];
}

/**
 * Merge remotes from personal and team configs
 */
function mergeRemotes(
  personal: RemotesConfig | undefined,
  team: RemotesConfig | undefined,
): RemotesConfig | undefined {
  if (!personal && !team) return undefined;
  if (!team) return personal;
  if (!personal) return team;

  const result: RemotesConfig = {};

  // personal.personal takes precedence (it's personal-only)
  const personalRemote = personal.personal ?? team.personal;
  if (personalRemote !== undefined) {
    result.personal = personalRemote;
  }

  // team.shared takes precedence (it's team-controlled)
  const sharedRemote = team.shared ?? personal.shared;
  if (sharedRemote !== undefined) {
    result.shared = sharedRemote;
  }

  // Merge custom arrays
  if (team.custom || personal.custom) {
    result.custom = [...(team.custom || []), ...(personal.custom || [])];
  }

  return result;
}

/**
 * Merge scalar fields with personal override behavior
 */
function mergeScalar<T>(
  personal: T | undefined,
  team: T | undefined,
): T | undefined {
  // Personal overrides team for scalars
  return personal !== undefined ? personal : team;
}

/**
 * Merge two configs following field ownership rules
 *
 * @param personal - Personal config (config.yaml)
 * @param team - Team config (config.team.yaml)
 * @returns Merged config with warnings
 */
export function mergeConfigs(
  personal: Partial<AlignTrueConfig> | undefined,
  team: Partial<AlignTrueConfig> | undefined,
): { config: Partial<AlignTrueConfig>; warnings: ConfigWarning[] } {
  const warnings: ConfigWarning[] = [];

  if (!team) {
    // No team config, just return personal
    return { config: personal || {}, warnings };
  }

  if (!personal) {
    // No personal config, just return team
    return { config: team, warnings };
  }

  // Check for field ownership violations
  const checkFieldOwnership = (
    obj: Record<string, unknown>,
    source: "personal" | "team",
    prefix = "",
  ) => {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;

      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const ownership = getFieldOwnership(fieldPath);

      if (source === "personal" && ownership === "team-only") {
        warnings.push({
          field: fieldPath,
          message: `'${fieldPath}' is a team-only field in personal config (ignored)`,
          level: "warn",
        });
      } else if (source === "team" && ownership === "personal-only") {
        warnings.push({
          field: fieldPath,
          message: `'${fieldPath}' is a personal-only field in team config (ignored)`,
          level: "warn",
        });
      }

      // Recurse into nested objects (but not arrays)
      if (typeof value === "object" && !Array.isArray(value)) {
        checkFieldOwnership(
          value as Record<string, unknown>,
          source,
          fieldPath,
        );
      }
    }
  };

  checkFieldOwnership(personal as Record<string, unknown>, "personal");
  checkFieldOwnership(team as Record<string, unknown>, "team");

  // Build modules object without undefined values
  const mergedModules: NonNullable<AlignTrueConfig["modules"]> = {};
  if (team.modules?.lockfile !== undefined) {
    mergedModules.lockfile = team.modules.lockfile;
  }
  if (team.modules?.bundle !== undefined) {
    mergedModules.bundle = team.modules.bundle;
  }
  const mergedChecks = mergeScalar(
    personal.modules?.checks,
    team.modules?.checks,
  );
  if (mergedChecks !== undefined) {
    mergedModules.checks = mergedChecks;
  }
  const mergedMcp = mergeScalar(personal.modules?.mcp, team.modules?.mcp);
  if (mergedMcp !== undefined) {
    mergedModules.mcp = mergedMcp;
  }

  // Build the merged config, only including defined values
  const merged: Record<string, unknown> = {};

  // Team-only fields (from team config only)
  if (team.mode !== undefined) {
    merged["mode"] = team.mode;
  }
  if (Object.keys(mergedModules).length > 0) {
    merged["modules"] = mergedModules;
  }
  if (team.lockfile !== undefined) {
    merged["lockfile"] = team.lockfile;
  }

  // Shared fields with merging
  const mergedVersion = mergeScalar(personal.version, team.version);
  if (mergedVersion !== undefined) {
    merged["version"] = mergedVersion;
  }

  const mergedSources = mergeSources(personal.sources, team.sources);
  if (mergedSources !== undefined) {
    merged["sources"] = mergedSources;
  }

  const mergedExporters = mergeExporters(personal.exporters, team.exporters);
  if (mergedExporters !== undefined) {
    merged["exporters"] = mergedExporters;
  }

  const mergedRemotes = mergeRemotes(personal.remotes, team.remotes);
  if (mergedRemotes !== undefined) {
    merged["remotes"] = mergedRemotes;
  }

  const mergedScopes = personal.scopes || team.scopes;
  if (mergedScopes !== undefined) {
    merged["scopes"] = mergedScopes;
  }

  const mergedOverlays = personal.overlays || team.overlays;
  if (mergedOverlays !== undefined) {
    merged["overlays"] = mergedOverlays;
  }

  // Shared scalars (personal overrides)
  const mergedGit = personal.git ?? team.git;
  if (mergedGit !== undefined) {
    merged["git"] = mergedGit;
  }

  const mergedMerge = personal.merge ?? team.merge;
  if (mergedMerge !== undefined) {
    merged["merge"] = mergedMerge;
  }

  const mergedPerformance = personal.performance ?? team.performance;
  if (mergedPerformance !== undefined) {
    merged["performance"] = mergedPerformance;
  }

  const mergedExport = personal.export ?? team.export;
  if (mergedExport !== undefined) {
    merged["export"] = mergedExport;
  }

  const mergedBackup = personal.backup ?? team.backup;
  if (mergedBackup !== undefined) {
    merged["backup"] = mergedBackup;
  }

  const mergedDetection = personal.detection ?? team.detection;
  if (mergedDetection !== undefined) {
    merged["detection"] = mergedDetection;
  }

  const mergedPlugs = personal.plugs ?? team.plugs;
  if (mergedPlugs !== undefined) {
    merged["plugs"] = mergedPlugs;
  }

  const mergedMcpConfig = personal.mcp ?? team.mcp;
  if (mergedMcpConfig !== undefined) {
    merged["mcp"] = mergedMcpConfig;
  }

  const mergedSync = personal.sync ?? team.sync;
  if (mergedSync !== undefined) {
    merged["sync"] = mergedSync;
  }

  // Clean up undefined values
  const cleanMerged = Object.fromEntries(
    Object.entries(merged).filter(([, v]) => v !== undefined),
  ) as Partial<AlignTrueConfig>;

  return { config: cleanMerged, warnings };
}

/**
 * Load merged configuration from both personal and team config files
 *
 * In solo mode: Only loads config.yaml
 * In team mode: Merges config.yaml (personal) with config.team.yaml (team)
 *
 * @param cwd - Working directory
 * @returns Merged config with metadata
 */
export async function loadMergedConfig(
  cwd: string = process.cwd(),
): Promise<ConfigMergeResult> {
  const paths = getAlignTruePaths(cwd);
  const warnings: ConfigWarning[] = [];

  // Check for team mode
  const teamModeActive = isTeamModeActive(cwd);
  const legacyTeamConfig = isLegacyTeamConfig(cwd);

  // Add legacy warning
  if (legacyTeamConfig) {
    warnings.push({
      field: "mode",
      message:
        "Legacy team config detected. Run 'aligntrue migrate config' to split into personal/team files.",
      level: "warn",
    });
  }

  // Load raw configs
  const personalRaw = loadRawConfig(paths.config);
  const teamRaw = teamModeActive ? loadRawConfig(paths.teamConfig) : undefined;

  // Track sources
  const sources: ConfigSources = {
    personal: !!personalRaw,
    team: !!teamRaw,
    fieldSources: new Map(),
  };

  // If neither exists, throw error
  if (!personalRaw && !teamRaw) {
    throw new Error(
      `Config file not found: ${paths.config}\n` +
        `  Run 'aligntrue init' to create one.`,
    );
  }

  // Merge configs
  const { config: mergedRaw, warnings: mergeWarnings } = mergeConfigs(
    personalRaw as Partial<AlignTrueConfig>,
    teamRaw as Partial<AlignTrueConfig>,
  );
  warnings.push(...mergeWarnings);

  // Validate merged config against schema
  const schemaValidation = validateConfigSchema(mergedRaw);
  if (!schemaValidation.valid) {
    throw new Error(
      `Invalid merged config:\n${formatConfigValidationErrors(schemaValidation.errors)}\n` +
        `  Check both ${paths.config} and ${paths.teamConfig}`,
    );
  }

  // Apply defaults
  const config = applyDefaults(mergedRaw as AlignTrueConfig);

  return {
    config,
    sources,
    warnings,
    isTeamMode: teamModeActive || legacyTeamConfig,
    isLegacyTeamConfig: legacyTeamConfig,
  };
}

/**
 * Get which config file a field value came from
 */
export function getConfigSource(
  fieldPath: string,
  cwd: string = process.cwd(),
): "personal" | "team" | "default" | "not-set" {
  const paths = getAlignTruePaths(cwd);

  const personalRaw = loadRawConfig(paths.config);
  const teamRaw = isTeamModeActive(cwd)
    ? loadRawConfig(paths.teamConfig)
    : undefined;

  // Helper to get nested value
  const getNestedValue = (
    obj: Record<string, unknown> | undefined,
    path: string,
  ): unknown => {
    if (!obj) return undefined;
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  };

  const personalValue = getNestedValue(personalRaw, fieldPath);
  const teamValue = getNestedValue(teamRaw, fieldPath);

  const ownership = getFieldOwnership(fieldPath);

  // Determine source based on ownership and presence
  if (ownership === "team-only") {
    if (teamValue !== undefined) return "team";
    return "default";
  }

  if (ownership === "personal-only") {
    if (personalValue !== undefined) return "personal";
    return "default";
  }

  // Shared fields: personal overrides team for scalars
  if (personalValue !== undefined) return "personal";
  if (teamValue !== undefined) return "team";
  return "default";
}
