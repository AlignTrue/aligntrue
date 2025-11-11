/**
 * Configuration management for AlignTrue
 * Handles solo/team/enterprise modes and module flags
 */

import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import {
  validateScopePath,
  validateGlobPatterns,
  validateMergeOrder,
  type MergeOrder,
} from "../scope.js";
import { getAlignTruePaths } from "../paths.js";
import type { OverlayConfig } from "../overlays/types.js";

export type AlignTrueMode = "solo" | "team" | "enterprise";
export type ModeHints = "off" | "metadata_only" | "hints" | "native";

export interface PerformanceConfig {
  max_file_size_mb?: number;
  max_directory_depth?: number;
  ignore_patterns?: string[];
}

export interface ExportConfig {
  mode_hints?: {
    default?: ModeHints;
    overrides?: Record<string, ModeHints>;
  };
  max_hint_blocks?: number;
  max_hint_tokens?: number;
}

export interface BackupConfig {
  auto_backup?: boolean;
  keep_count?: number;
  backup_on?: Array<"sync" | "restore" | "import">;
}

export interface DetectionConfig {
  auto_enable?: boolean;
  ignored_agents?: string[];
}

export interface AlignTrueConfig {
  version: string | undefined;
  mode: AlignTrueMode;
  modules?: {
    lockfile?: boolean;
    bundle?: boolean;
    checks?: boolean;
    mcp?: boolean;
  };
  lockfile?: {
    mode?: "off" | "soft" | "strict";
  };
  git?: {
    mode?: "ignore" | "commit" | "branch";
    per_adapter?: Record<string, "ignore" | "commit" | "branch">;
  };
  sync?: {
    auto_pull?: boolean;
    primary_agent?: string;
    on_conflict?: "prompt" | "keep_ir" | "accept_agent";
    workflow_mode?: "auto" | "ir_source" | "native_format";
    show_diff_on_pull?: boolean;
    two_way?: boolean; // Default true - enable bidirectional sync
    watch_enabled?: boolean; // Enable watch mode
    watch_debounce?: number; // Debounce delay in milliseconds
    watch_files?: string[]; // Files/patterns to watch
  };
  managed?: {
    files?: string[]; // Full file paths to protect
    sections?: string[]; // Section headings to protect
    source_url?: string; // Team repo URL for display
  };
  sources?: Array<{
    type: "local" | "git" | "url";
    path?: string;
    url?: string;
    ref?: string; // Git branch/tag/commit
    id?: string;
    version?: string;
  }>;
  exporters?: string[];
  scopes?: Array<{
    path: string;
    include?: string[];
    exclude?: string[];
    rulesets?: string[];
  }>;
  merge?: {
    strategy?: "deep";
    order?: MergeOrder;
  };
  performance?: PerformanceConfig;
  export?: ExportConfig;
  backup?: BackupConfig;
  detection?: DetectionConfig;
  overlays?: OverlayConfig;
}

/**
 * Validation result from schema validation
 */
interface SchemaValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    keyword?: string;
    params?: Record<string, unknown>;
  }>;
}

// Load JSON Schema and initialize Ajv
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "../../schema/config.schema.json");
const configSchema = JSON.parse(readFileSync(schemaPath, "utf8"));

const ajv = new Ajv({
  strict: true,
  allErrors: true,
  verbose: true,
  validateSchema: false, // Avoid metaschema validation issues
});
addFormats(ajv);

const validateSchemaFn: ValidateFunction = ajv.compile(configSchema);

/**
 * Validate config against JSON Schema
 */
function validateConfigSchema(config: unknown): SchemaValidationResult {
  const valid = validateSchemaFn(config);

  if (valid) {
    return { valid: true };
  }

  const errors = (validateSchemaFn.errors || []).map((err: ErrorObject) => {
    const path = err.instancePath || "(root)";
    let message = err.message || "Validation error";

    // Enhance error messages with more context
    if (err.keyword === "enum") {
      const allowedValues =
        (err.params as { allowedValues?: unknown[] }).allowedValues || [];
      message = `${message}. Allowed values: ${allowedValues.join(", ")}`;
    } else if (err.keyword === "required") {
      const missingProperty = (err.params as { missingProperty?: string })
        .missingProperty;
      message = `Missing required field: ${missingProperty}`;
    } else if (err.keyword === "type") {
      const expectedType = (err.params as { type?: string }).type;
      message = `Expected type ${expectedType}`;
    }

    return {
      path: path.replace(/^\//, "").replace(/\//g, ".") || "(root)",
      message,
      keyword: err.keyword,
      params: err.params as Record<string, unknown>,
    };
  });

  return { valid: false, errors };
}

/**
 * Format validation errors for user display
 */
function formatValidationErrors(
  errors: SchemaValidationResult["errors"],
): string {
  if (!errors || errors.length === 0) {
    return "Unknown validation error";
  }

  return errors.map((err) => `  - ${err.path}: ${err.message}`).join("\n");
}

/**
 * Apply mode-specific defaults to config
 */
export function applyDefaults(config: AlignTrueConfig): AlignTrueConfig {
  const result: AlignTrueConfig = { ...config };

  // Auto-detect mode if not specified
  if (!result.mode) {
    // If only exporters configured (minimal config), default to solo
    if (
      result.exporters &&
      result.exporters.length > 0 &&
      !result.modules?.lockfile &&
      !result.modules?.bundle
    ) {
      result.mode = "solo";
    } else if (result.modules?.lockfile || result.modules?.bundle) {
      result.mode = "team";
    } else {
      result.mode = "solo"; // Default to solo
    }
  }

  // Auto-set version if not specified
  if (!result.version) {
    result.version = "1";
  }

  // Initialize modules if not present
  if (!result.modules) {
    result.modules = {};
  }

  /**
   * Module defaults differ by mode
   *
   * Solo mode:
   * - lockfile: disabled (no need for reproducibility in solo workflows)
   * - bundle: disabled (no multi-source merging needed)
   * - checks: enabled (always validate rules)
   *
   * Team/enterprise mode:
   * - lockfile: enabled (ensures reproducible builds across team)
   * - bundle: enabled (merge rules from multiple sources)
   * - checks: enabled (validate rules and detect drift)
   *
   * Lockfile modes (team only):
   * - "off": No lockfile validation
   * - "soft": Warn on drift but don't fail
   * - "strict": Fail on any drift (recommended for CI)
   */
  if (result.mode === "solo") {
    result.modules.lockfile = result.modules.lockfile ?? false;
    result.modules.bundle = result.modules.bundle ?? false;
    result.modules.checks = result.modules.checks ?? true;
    result.modules.mcp = result.modules.mcp ?? false;
  } else if (result.mode === "team") {
    result.modules.lockfile = result.modules.lockfile ?? true;
    result.modules.bundle = result.modules.bundle ?? true;
    result.modules.checks = result.modules.checks ?? true;
    result.modules.mcp = result.modules.mcp ?? false;
  } else if (result.mode === "enterprise") {
    result.modules.lockfile = result.modules.lockfile ?? true;
    result.modules.bundle = result.modules.bundle ?? true;
    result.modules.checks = result.modules.checks ?? true;
    result.modules.mcp = result.modules.mcp ?? true;
  }

  // Apply lockfile defaults
  if (!result.lockfile) {
    result.lockfile = {};
  }
  // Default to 'soft' mode for team/enterprise when lockfile enabled
  if (result.modules.lockfile) {
    result.lockfile.mode = result.lockfile.mode ?? "soft";
  } else {
    result.lockfile.mode = result.lockfile.mode ?? "off";
  }

  // Apply git defaults
  if (!result.git) {
    result.git = {};
  }

  /**
   * Git mode defaults differ by mode
   *
   * Solo mode: "ignore" (don't commit .aligntrue files by default)
   * - Rationale: Solo devs often experiment locally, don't need version control
   * - Can manually commit if desired
   *
   * Team/enterprise mode: "commit" (commit .aligntrue files automatically)
   * - Rationale: Teams need shared rules in version control
   * - Enables collaboration and drift detection
   *
   * To override: Set git.mode in config
   */
  if (result.mode === "solo" || result.mode === "team") {
    result.git.mode = result.git.mode ?? "ignore";
  } else if (result.mode === "enterprise") {
    result.git.mode = result.git.mode ?? "commit";
  }

  // Apply sync defaults
  if (!result.sync) {
    result.sync = {};
  }

  /**
   * Solo mode: Auto-pull ENABLED by default
   *
   * Rationale: Solo devs benefit from native-format editing (edit .cursor rules directly).
   * Auto-pull keeps IR in sync with agent edits automatically.
   *
   * - auto_pull: true (pulls from primary_agent before each sync)
   * - on_conflict: accept_agent (agent edits win over IR when conflicts detected)
   * - primary_agent: auto-detected from first importable exporter
   * - workflow_mode: auto (prompt on first conflict to choose workflow)
   * - show_diff_on_pull: true (show brief diff when auto-pull executes)
   *
   * To disable: Set sync.auto_pull: false in config
   */
  if (result.mode === "solo") {
    result.sync.auto_pull = result.sync.auto_pull ?? true;
    result.sync.on_conflict = result.sync.on_conflict ?? "accept_agent";
    result.sync.workflow_mode = result.sync.workflow_mode ?? "auto";
    result.sync.show_diff_on_pull = result.sync.show_diff_on_pull ?? true;

    // Auto-detect primary_agent if not set (first exporter that supports import)
    if (
      !result.sync.primary_agent &&
      result.exporters &&
      result.exporters.length > 0
    ) {
      const importableAgents = [
        "cursor",
        "copilot",
        "claude-code",
        "aider",
        "agents-md",
      ];
      const detected = result.exporters.find((e) =>
        importableAgents.includes(e.toLowerCase()),
      );
      if (detected) {
        result.sync.primary_agent = detected;
      }
    }
  } else {
    /**
     * Team/enterprise mode: Auto-pull DISABLED by default
     *
     * Rationale: Teams need explicit review before accepting agent edits.
     * IR is the single source of truth, modified only through explicit commands.
     *
     * - auto_pull: false (manual import only with --accept-agent)
     * - on_conflict: prompt (ask user to resolve conflicts)
     * - workflow_mode: ir_source (IR is source of truth)
     * - show_diff_on_pull: true (show diff when manual import via --accept-agent)
     *
     * To enable: Set sync.auto_pull: true in config (not recommended for teams)
     */
    result.sync.auto_pull = result.sync.auto_pull ?? false;
    result.sync.on_conflict = result.sync.on_conflict ?? "prompt";
    result.sync.workflow_mode = result.sync.workflow_mode ?? "ir_source";
    result.sync.show_diff_on_pull = result.sync.show_diff_on_pull ?? true;
  }

  // Apply exporter defaults
  if (!result.exporters || result.exporters.length === 0) {
    result.exporters = ["cursor", "agents-md"];
  }

  // Apply source defaults
  if (!result.sources || result.sources.length === 0) {
    result.sources = [{ type: "local", path: ".aligntrue/.rules.yaml" }];
  }

  // Apply performance defaults
  if (!result.performance) {
    result.performance = {};
  }
  result.performance.max_file_size_mb =
    result.performance.max_file_size_mb ?? 10;
  result.performance.max_directory_depth =
    result.performance.max_directory_depth ?? 10;
  result.performance.ignore_patterns = result.performance.ignore_patterns ?? [];

  // Apply backup defaults
  if (!result.backup) {
    result.backup = {};
  }
  result.backup.auto_backup = result.backup.auto_backup ?? true;
  result.backup.keep_count = result.backup.keep_count ?? 5;
  result.backup.backup_on = result.backup.backup_on ?? ["sync", "import"];

  // Apply detection defaults
  if (!result.detection) {
    result.detection = {};
  }
  result.detection.auto_enable = result.detection.auto_enable ?? false;
  result.detection.ignored_agents = result.detection.ignored_agents ?? [];

  return result;
}

/**
 * Check for unknown fields and emit warnings
 */
function checkUnknownFields(
  config: Record<string, unknown>,
  configPath: string,
): void {
  const knownFields = new Set([
    "version",
    "mode",
    "modules",
    "lockfile",
    "git",
    "sync",
    "sources",
    "exporters",
    "scopes",
    "merge",
    "performance",
    "export",
    "backup",
    "detection",
    "overlays",
  ]);

  for (const key of Object.keys(config)) {
    if (!knownFields.has(key)) {
      console.warn(
        `Warning: Unknown config field "${key}" in ${configPath}\n` +
          `  This field will be ignored. Valid fields: ${Array.from(knownFields).join(", ")}`,
      );
    }
  }
}

/**
 * Validate configuration structure and values
 */
export async function validateConfig(
  config: AlignTrueConfig,
  configPath?: string,
): Promise<void> {
  // Validate mode
  const validModes: AlignTrueMode[] = ["solo", "team", "enterprise"];
  if (!validModes.includes(config.mode)) {
    throw new Error(
      `Invalid mode "${config.mode}": must be one of ${validModes.join(", ")}`,
    );
  }

  // Check for unknown fields (warnings only)
  if (configPath) {
    checkUnknownFields(
      config as unknown as Record<string, unknown>,
      configPath,
    );
  }

  // Validate module flags if present
  if (config.modules) {
    for (const [key, value] of Object.entries(config.modules)) {
      if (typeof value !== "boolean" && value !== undefined) {
        throw new Error(
          `Invalid modules.${key}: must be boolean, got ${typeof value}`,
        );
      }
    }
  }

  // Validate sources array if present
  if (config.sources && Array.isArray(config.sources)) {
    for (let i = 0; i < config.sources.length; i++) {
      const source = config.sources[i];
      if (!source || typeof source !== "object") {
        throw new Error(`Invalid source at index ${i}: must be an object`);
      }

      // Type-specific validation
      if (source.type === "local" && !source.path) {
        throw new Error(
          `Invalid source at index ${i}: "path" is required for type "local"`,
        );
      } else if (
        (source.type === "git" || source.type === "url") &&
        !source.url
      ) {
        throw new Error(
          `Invalid source at index ${i}: "url" is required for type "${source.type}"`,
        );
      }

      // Security: Validate local source paths for traversal attacks
      if (source.type === "local" && source.path) {
        try {
          validateScopePath(source.path);
        } catch (_err) {
          throw new Error(
            `Invalid source at index ${i}: ${_err instanceof Error ? _err.message : String(_err)}`,
          );
        }
      }
    }
  }

  // Validate exporters array if present
  if (config.exporters && Array.isArray(config.exporters)) {
    for (let i = 0; i < config.exporters.length; i++) {
      const exporter = config.exporters[i];
      if (typeof exporter !== "string" || exporter.trim() === "") {
        throw new Error(
          `Invalid exporter at index ${i}: must be non-empty string`,
        );
      }
    }
  }

  // Validate scopes array if present
  if (config.scopes && Array.isArray(config.scopes)) {
    for (let i = 0; i < config.scopes.length; i++) {
      const scope = config.scopes[i];
      if (!scope) {
        throw new Error(
          `Invalid scope at index ${i}: scope is null or undefined`,
        );
      }

      // Validate required path field
      if (!scope.path || typeof scope.path !== "string") {
        throw new Error(
          `Invalid scope at index ${i}: missing or invalid "path" field`,
        );
      }

      try {
        validateScopePath(scope.path);
      } catch (_err) {
        throw new Error(
          `Invalid scope at index ${i}: ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }

      try {
        validateGlobPatterns(scope.include);
      } catch (_err) {
        throw new Error(
          `Invalid scope at index ${i}, include patterns: ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }

      try {
        validateGlobPatterns(scope.exclude);
      } catch (_err) {
        throw new Error(
          `Invalid scope at index ${i}, exclude patterns: ${_err instanceof Error ? _err.message : String(_err)}`,
        );
      }

      // Validate rulesets is array of strings if present
      if (scope.rulesets !== undefined) {
        if (!Array.isArray(scope.rulesets)) {
          throw new Error(
            `Invalid scope at index ${i}: "rulesets" must be an array`,
          );
        }
        for (const ruleset of scope.rulesets) {
          if (typeof ruleset !== "string") {
            throw new Error(
              `Invalid scope at index ${i}: ruleset IDs must be strings`,
            );
          }
        }
      }
    }

    // Warn if scopes defined but empty
    if (config.scopes.length === 0) {
      console.warn(
        `Warning: "scopes" array is defined but empty. Consider removing it or adding scope definitions.`,
      );
    }
  }

  // Validate merge order if present
  if (config.merge?.order) {
    try {
      validateMergeOrder(config.merge.order);
    } catch (_err) {
      throw new Error(
        `Invalid merge order: ${_err instanceof Error ? _err.message : String(_err)}`,
      );
    }
  }

  // Validate git mode if present
  if (config.git?.mode) {
    const validGitModes = ["ignore", "commit", "branch"];
    if (!validGitModes.includes(config.git.mode)) {
      throw new Error(
        `Invalid git mode "${config.git.mode}": must be one of ${validGitModes.join(", ")}`,
      );
    }
  }

  // Cross-field validation: warn about mode/module inconsistencies
  if (config.mode === "solo" && config.modules?.lockfile === true) {
    console.warn(
      `Warning: Solo mode with lockfile enabled is unusual.\n` +
        `  Consider using 'mode: team' if you need lockfile features.`,
    );
  }

  if (config.mode === "solo" && config.modules?.bundle === true) {
    console.warn(
      `Warning: Solo mode with bundle enabled is unusual.\n` +
        `  Consider using 'mode: team' if you need bundle features.`,
    );
  }
}

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
      `Invalid config in ${path}:\n${formatValidationErrors(schemaValidation.errors)}\n` +
        `  See config.schema.json for full specification.`,
    );
  }

  // Cast to config type (safe after schema validation)
  const typedConfig = config as AlignTrueConfig;

  // Apply defaults
  const configWithDefaults = applyDefaults(typedConfig);

  // Run enhanced validation (scopes, paths, cross-field checks)
  await validateConfig(configWithDefaults, path);

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
  mkdirSync(dirname(path), { recursive: true });

  // Write to temp file first
  writeFileSync(tempPath, yamlContent, "utf-8");

  // Rename atomically (overwrites destination)
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
  if (config.exporters && config.exporters.length > 0) {
    minimalConfig.exporters = config.exporters;
  }

  // Only add fields that differ from defaults
  // Use same mode as config to get correct mode-specific defaults
  const defaults = applyDefaults({
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

  if (
    config.sync?.auto_pull !== defaults.sync?.auto_pull &&
    config.sync?.auto_pull !== undefined
  ) {
    syncSection.auto_pull = config.sync.auto_pull;
    hasSyncChanges = true;
  }
  if (
    config.sync?.on_conflict !== defaults.sync?.on_conflict &&
    config.sync?.on_conflict !== undefined
  ) {
    syncSection.on_conflict = config.sync.on_conflict;
    hasSyncChanges = true;
  }
  if (
    config.sync?.workflow_mode !== defaults.sync?.workflow_mode &&
    config.sync?.workflow_mode !== undefined
  ) {
    syncSection.workflow_mode = config.sync.workflow_mode;
    hasSyncChanges = true;
  }
  if (
    config.sync?.primary_agent !== defaults.sync?.primary_agent &&
    config.sync?.primary_agent !== undefined
  ) {
    syncSection.primary_agent = config.sync.primary_agent;
    hasSyncChanges = true;
  }
  if (
    config.sync?.show_diff_on_pull !== defaults.sync?.show_diff_on_pull &&
    config.sync?.show_diff_on_pull !== undefined
  ) {
    syncSection.show_diff_on_pull = config.sync.show_diff_on_pull;
    hasSyncChanges = true;
  }

  if (hasSyncChanges) {
    minimalConfig.sync = syncSection;
  }

  // Sources: only if not default
  const defaultSources = JSON.stringify([
    { type: "local", path: ".aligntrue/.rules.yaml" },
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

/**
 * Get mode hints setting for a specific exporter
 * Handles precedence: override > default > 'metadata_only'
 * Forces 'native' for cursor and yaml exporters
 */
export function getModeHints(
  exporterName: string,
  config: AlignTrueConfig,
): ModeHints {
  // Force native for cursor and yaml (cannot be overridden)
  if (exporterName === "cursor" || exporterName === "yaml") {
    return "native";
  }

  // Check for per-exporter override
  const override = config.export?.mode_hints?.overrides?.[exporterName];
  if (override) {
    return override;
  }

  // Use global default or fall back to metadata_only
  return config.export?.mode_hints?.default ?? "metadata_only";
}
