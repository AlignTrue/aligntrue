/**
 * Configuration validation and defaults
 *
 * This module handles all configuration validation:
 * 1. JSON Schema validation (via Ajv)
 * 2. Default value application (applyDefaults)
 * 3. Structural and semantic validation (validateConfig)
 *
 * Future refactoring:
 * If this file exceeds 1000 lines, consider splitting into:
 * - config-schema.ts: Schema validation and Ajv setup
 * - config-defaults.ts: Default application logic
 * - config-validation.ts: Structural/semantic validation
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import {
  validateScopePath,
  validateGlobPatterns,
  validateMergeOrder,
} from "../scope.js";
import { EXPORTER_TO_EDIT_SOURCE_PATTERN } from "../config/edit-source-patterns.js";
import type {
  AlignTrueConfig,
  AlignTrueMode,
  ModeHints,
} from "../config/types.js";

// Track shown warnings to prevent duplication
const shownWarnings = new Set<string>();

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
// Schema path works for both source (src/validation -> ../../schema) and dist (dist/validation -> ../schema)
// Try dist path first (runtime), fall back to source path (tests)
let schemaPath = resolve(__dirname, "../schema/config.schema.json");
if (!existsSync(schemaPath)) {
  schemaPath = resolve(__dirname, "../../schema/config.schema.json");
}

// Safe: Internal schema file path, resolved from __dirname at build time (not user input)
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
export function validateConfigSchema(config: unknown): SchemaValidationResult {
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
export function formatConfigValidationErrors(
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

  // Apply git source update check interval defaults
  result.git.branch_check_interval = result.git.branch_check_interval ?? 86400; // 24 hours
  result.git.tag_check_interval = result.git.tag_check_interval ?? 604800; // 7 days
  result.git.offline_fallback = result.git.offline_fallback ?? true;
  result.git.auto_gitignore = result.git.auto_gitignore ?? "auto";

  // Apply sync defaults
  if (!result.sync) {
    result.sync = {};
  }

  /**
   * two_way is deprecated - no migration needed (no backward compatibility required)
   * Users on old config will need to manually update
   */

  /**
   * Set edit_source default if not specified
   *
   * Default logic (single source only):
   * - Prefer Cursor (multi-file) if enabled
   * - Fallback to AGENTS.md if agents exporter enabled
   * - Otherwise first enabled exporter
   * - No fallback - if no exporters configured, edit_source remains undefined
   *
   * Note: edit_source controls which files accept edits and sync TO canonical IR.
   * IR (.aligntrue/.rules.yaml) is always the canonical source of truth.
   * This setting just controls the input gate to IR.
   *
   * Multi-source editing requires centralized: false (not set here).
   */
  if (result.sync.edit_source === undefined) {
    // Priority order: cursor (multi-file) > agents (universal) > others
    const priorityOrder = ["cursor", "agents", "copilot", "claude", "aider"];

    for (const exporter of priorityOrder) {
      if ((result.exporters || []).includes(exporter)) {
        const pattern =
          EXPORTER_TO_EDIT_SOURCE_PATTERN[
            exporter as keyof typeof EXPORTER_TO_EDIT_SOURCE_PATTERN
          ];
        if (pattern) {
          result.sync.edit_source = pattern;
          break;
        }
      }
    }
    // If no priority exporters, use first enabled
    if (!result.sync.edit_source && (result.exporters || []).length > 0) {
      const firstExporter = (result.exporters || [])[0];
      if (firstExporter) {
        const pattern =
          EXPORTER_TO_EDIT_SOURCE_PATTERN[
            firstExporter as keyof typeof EXPORTER_TO_EDIT_SOURCE_PATTERN
          ];
        if (pattern) {
          result.sync.edit_source = pattern;
        }
      }
    }
  }

  /**
   * Set scope_prefixing default
   */
  if (result.sync.scope_prefixing === undefined) {
    result.sync.scope_prefixing = "off";
  }

  /**
   * Set backup defaults
   *
   * Solo mode: auto (enabled)
   * Team/enterprise: auto (disabled, git history is backup)
   */
  /**
   * source_files intentionally REMOVED
   *
   * edit_source now controls both:
   * - which files accept edits (for two-way sync detection)
   * - where to load rules FROM (multi-file source organization)
   *
   * When edit_source contains glob patterns, loadIR uses loadSourceFiles()
   * When edit_source is undefined or single file, loadIR reads .rules.yaml directly
   */

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
        "claude",
        "aider",
        "agents",
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
    result.exporters = ["cursor", "agents"];
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
  result.backup.keep_count = result.backup.keep_count ?? 20;
  // Enforce keep_count bounds (min 10, max 100)
  if (result.backup.keep_count < 10) result.backup.keep_count = 10;
  if (result.backup.keep_count > 100) result.backup.keep_count = 100;

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
export function checkUnknownFields(
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
    "managed",
    "sources",
    "exporters",
    "scopes",
    "merge",
    "performance",
    "export",
    "backup",
    "detection",
    "overlays",
    "plugs",
    // "approval", // DEPRECATED: removed
  ]);

  for (const key of Object.keys(config)) {
    // Allow vendor.* fields explicitly
    if (key.startsWith("vendor.")) {
      continue;
    }

    if (!knownFields.has(key)) {
      const warningKey = `unknown-field:${configPath}:${key}`;
      if (shownWarnings.has(warningKey)) {
        continue;
      }
      shownWarnings.add(warningKey);
      console.warn(
        `Warning: Unrecognized config field "${key}" in ${configPath}\n` +
          `\n` +
          `This field will be ignored. Did you mean one of these?\n` +
          `  - Common fields: version, mode, sync, sources, exporters\n` +
          `  - Vendor fields: vendor.${key} (for custom/third-party integrations)\n` +
          `\n` +
          `Valid fields: ${Array.from(knownFields).join(", ")}\n` +
          `Run 'aligntrue config list' to see all recognized fields`,
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

  // Validate centralized and edit_source
  if (config.sync) {
    const editSource = config.sync.edit_source;
    const centralized = config.sync.centralized;

    if (Array.isArray(editSource) && centralized !== false) {
      throw new Error(
        `Error: Multiple edit sources require decentralized mode\n` +
          `  Current edit_source: ${JSON.stringify(editSource)}\n` +
          `\n` +
          `To enable multi-file editing, run:\n` +
          `  aligntrue config set sync.centralized false\n` +
          `\n` +
          `Or use a single edit source:\n` +
          `  aligntrue config set sync.edit_source '"AGENTS.md"'\n` +
          `\n` +
          `Learn more: https://aligntrue.ai/docs/concepts/sync-behavior`,
      );
    }
  }

  // Validate exporters array if present
  if (config.exporters && Array.isArray(config.exporters)) {
    const MAX_EXPORTERS = 20;
    const WARN_EXPORTERS_THRESHOLD = 10;

    // Check count limits
    if (config.exporters.length > MAX_EXPORTERS) {
      throw new Error(
        `Too many exporters configured (${config.exporters.length}). Maximum allowed is ${MAX_EXPORTERS}.`,
      );
    }

    if (config.exporters.length > WARN_EXPORTERS_THRESHOLD) {
      const warningKey = "too-many-exporters";
      if (!shownWarnings.has(warningKey)) {
        shownWarnings.add(warningKey);
        console.warn(
          `Warning: ${config.exporters.length} exporters configured. This may slow down sync operations.`,
        );
      }
    }

    // Check for duplicates
    const uniqueExporters = new Set(config.exporters);
    if (uniqueExporters.size !== config.exporters.length) {
      const seen = new Set();
      const duplicates = new Set();
      for (const exporter of config.exporters) {
        if (seen.has(exporter)) {
          duplicates.add(exporter);
        }
        seen.add(exporter);
      }
      throw new Error(
        `Duplicate exporters found: ${Array.from(duplicates).join(", ")}`,
      );
    }

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

  // Cross-field validation: warn about mode/module inconsistencies (once per process)
  if (config.mode === "solo" && config.modules?.lockfile === true) {
    const warningKey = "solo-lockfile-mismatch";
    if (!shownWarnings.has(warningKey)) {
      shownWarnings.add(warningKey);
      console.warn(
        `Warning: Solo mode with lockfile enabled is unusual.\n` +
          `  Consider using 'mode: team' if you need lockfile features.`,
      );
    }
  }

  if (config.mode === "solo" && config.modules?.bundle === true) {
    const warningKey = "solo-bundle-mismatch";
    if (!shownWarnings.has(warningKey)) {
      shownWarnings.add(warningKey);
      console.warn(
        `Warning: Solo mode with bundle enabled is unusual.\n` +
          `  Consider using 'mode: team' if you need bundle features.`,
      );
    }
  }
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

/**
 * Check if a path is a valid config key
 */
export function isValidConfigKey(key: string): boolean {
  const validKeys = new Set([
    "version",
    "mode",
    "modules",
    "modules.lockfile",
    "modules.bundle",
    "modules.checks",
    "modules.mcp",
    "lockfile",
    "lockfile.mode",
    "git",
    "git.mode",
    "git.branch_check_interval",
    "git.tag_check_interval",
    "git.offline_fallback",
    "git.auto_gitignore",
    "sync",
    "sync.auto_pull",
    "sync.primary_agent",
    "sync.on_conflict",
    "sync.workflow_mode",
    "sync.show_diff_on_pull",
    "sync.edit_source",
    "sync.centralized",
    "sync.scope_prefixing",
    "sync.watch_enabled",
    "sync.watch_debounce",
    "sync.watch_files",
    "managed",
    "managed.files",
    "managed.sections",
    "managed.source_url",
    "sources",
    "exporters",
    "scopes",
    "merge",
    "merge.strategy",
    "merge.order",
    "performance",
    "performance.max_file_size_mb",
    "performance.max_directory_depth",
    "performance.ignore_patterns",
    "export",
    "export.mode_hints",
    "export.max_hint_blocks",
    "export.max_hint_tokens",
    "backup",
    "backup.keep_count",
    "detection",
    "detection.auto_enable",
    "detection.ignored_agents",
    "overlays",
    "plugs",
    "plugs.fills",
    "mcp",
    "mcp.servers",
    "resources",
    "resources.rules",
    "resources.mcps",
    "resources.skills",
    "storage",
  ]);

  // Allow vendor keys
  if (key.startsWith("vendor.")) {
    return true;
  }

  // Check exact match
  if (validKeys.has(key)) {
    return true;
  }

  // Check if it's a nested key under a valid parent or array index
  // e.g., "sources.0.type" is valid if "sources" is valid
  const parts = key.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentKey = parts.slice(0, i).join(".");
    if (validKeys.has(parentKey)) {
      return true;
    }
  }

  // Special case for dynamic keys like resources.*.storage
  if (key.startsWith("resources.")) {
    return true;
  }

  if (key.startsWith("storage.")) {
    return true;
  }

  return false;
}

/**
 * Reset shown warnings (for testing)
 * @internal
 */
export function resetShownWarnings(): void {
  shownWarnings.clear();
}
