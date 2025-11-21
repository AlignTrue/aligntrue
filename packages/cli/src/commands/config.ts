/**
 * Config command - Display and edit configuration
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import * as clack from "@clack/prompts";
import { spawn } from "child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getAlignTruePaths } from "@aligntrue/core";
import type { AlignTrueConfig } from "@aligntrue/core";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

/**
 * Argument definitions for config command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Config command implementation
 */
export async function config(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  // Extract subcommand from positional args
  const subcommand = parsed.positional[0] as
    | "show"
    | "edit"
    | "summary"
    | "get"
    | "set"
    | "list"
    | "unset"
    | undefined;

  if (parsed.help || !subcommand) {
    showStandardHelp({
      name: "config",
      description: "Display or edit configuration",
      usage: "aligntrue config <subcommand>",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue config show",
        "aligntrue config edit",
        "aligntrue config summary",
        "aligntrue config get mode",
        "aligntrue config set mode team",
        "aligntrue config list",
        "aligntrue config unset sync.edit_source",
      ],
      notes: [
        "Subcommands:",
        "  show     Display active configuration with mode and effective settings",
        "  edit     Open config file in default editor",
        "  summary  Display concise configuration summary",
        "  get      Get a single config value (supports dot notation)",
        "  set      Set a config value with validation",
        "  list     List all config values as key-value pairs",
        "  unset    Remove an optional config value",
        "",
        "Description:",
        "  The show command displays your active mode (solo/team/enterprise) and",
        "  effective configuration including defaults.",
        "",
        "  The edit command opens .aligntrue/config.yaml in your default editor.",
        "",
        "  The get/set/list/unset commands allow programmatic config management.",
        "  Use dot notation for nested keys (e.g., sync.edit_source).",
      ],
    });
    process.exit(0);
    return;
  }

  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);
  const configPath = paths.config;

  // Check if config exists
  if (!existsSync(configPath)) {
    clack.log.error(`Config file not found: ${configPath}`);
    clack.log.info(`Run 'aligntrue init' to create initial configuration`);
    process.exit(1);
  }

  if (subcommand === "show") {
    await showConfig(configPath);
  } else if (subcommand === "edit") {
    await editConfig(configPath);
  } else if (subcommand === "summary") {
    await showSummary(configPath);
  } else if (subcommand === "get") {
    const key = parsed.positional[1];
    if (!key) {
      clack.log.error("Missing key argument");
      clack.log.info("Usage: aligntrue config get <key>");
      clack.log.info("Example: aligntrue config get mode");
      process.exit(2);
    }
    await configGet(configPath, key);
  } else if (subcommand === "set") {
    const key = parsed.positional[1];
    const value = parsed.positional[2];
    if (!key || !value) {
      clack.log.error("Missing key or value argument");
      clack.log.info("Usage: aligntrue config set <key> <value>");
      clack.log.info("Example: aligntrue config set mode team");
      process.exit(2);
    }
    await configSet(configPath, key, value);
  } else if (subcommand === "list") {
    await configList(configPath);
  } else if (subcommand === "unset") {
    const key = parsed.positional[1];
    if (!key) {
      clack.log.error("Missing key argument");
      clack.log.info("Usage: aligntrue config unset <key>");
      clack.log.info("Example: aligntrue config unset sync.edit_source");
      process.exit(2);
    }
    await configUnset(configPath, key);
  } else {
    clack.log.error(`Unknown subcommand: ${subcommand}`);
    clack.log.info("Run 'aligntrue config --help' for usage");
    process.exit(2);
  }
}

/**
 * Show configuration with mode and effective settings
 */
async function showConfig(configPath: string): Promise<void> {
  clack.intro("AlignTrue Configuration");

  try {
    const { loadConfig } = await import("@aligntrue/core");
    const cfg = await loadConfig(configPath);

    // Display mode prominently
    const modeColors: Record<string, string> = {
      solo: "🟢",
      team: "🟡",
      enterprise: "🔵",
    };
    console.log(
      `\n${modeColors[cfg.mode] || "⚪"} Mode: ${cfg.mode.toUpperCase()}`,
    );

    // Display key settings
    console.log(`\n📋 Configuration:`);
    console.log(`  Version: ${cfg.version}`);
    console.log(`  Exporters: ${cfg.exporters?.join(", ") || "none"}`);

    if (cfg.sync) {
      console.log(`\n🔄 Sync:`);
      const workflowMode = cfg.sync.workflow_mode || "auto";
      console.log(`  Workflow mode: ${workflowMode}`);
      if (workflowMode === "native_format") {
        console.log(
          `    → Edit in primary agent, AlignTrue syncs automatically`,
        );
      } else if (workflowMode === "ir_source") {
        console.log(`    → Edit AGENTS.md as source of truth`);
      } else if (workflowMode === "auto") {
        console.log(`    → Auto-detects based on import source`);
      }
      console.log(`  Auto-pull: ${cfg.sync.auto_pull ?? "not set"}`);
      if (cfg.sync.primary_agent) {
        console.log(`  Primary agent: ${cfg.sync.primary_agent}`);
      }
      console.log(`  On conflict: ${cfg.sync.on_conflict || "prompt"}`);
    }

    if (cfg.modules) {
      console.log(`\n⚙️  Modules:`);
      console.log(
        `  Lockfile: ${cfg.modules.lockfile ? "enabled" : "disabled"}`,
      );
      console.log(`  Bundle: ${cfg.modules.bundle ? "enabled" : "disabled"}`);
      console.log(`  Checks: ${cfg.modules.checks ? "enabled" : "disabled"}`);
    }

    if (cfg.lockfile && cfg.modules?.lockfile) {
      console.log(`\n🔒 Lockfile:`);
      console.log(`  Mode: ${cfg.lockfile.mode || "off"}`);
    }

    if (cfg.git) {
      console.log(`\n📦 Git:`);
      console.log(`  Mode: ${cfg.git.mode || "ignore"}`);
    }

    if (cfg.scopes && cfg.scopes.length > 0) {
      console.log(`\n📍 Scopes: ${cfg.scopes.length} configured`);
    }

    console.log(`\n📝 Config file: ${configPath}`);

    clack.outro("Configuration displayed");
  } catch (_error) {
    clack.log.error(
      `Failed to load config: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    process.exit(1);
  }
}

/**
 * Open config file in default editor
 */
async function editConfig(configPath: string): Promise<void> {
  clack.intro("Edit Configuration");

  // Determine editor
  const editor = process.env["EDITOR"] || process.env["VISUAL"] || "vi";

  clack.log.info(`Opening ${configPath} in ${editor}`);

  return new Promise((resolve, reject) => {
    const child = spawn(editor, [configPath], {
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        clack.outro("Configuration updated");
        resolve();
      } else {
        clack.log.error(`Editor exited with code ${code}`);
        reject(new Error(`Editor exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      clack.log.error(`Failed to open editor: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Show concise configuration summary
 */
async function showSummary(configPath: string): Promise<void> {
  try {
    const { loadConfig } = await import("@aligntrue/core");
    const config = await loadConfig(configPath);

    console.log("Current configuration:");
    console.log(`  Mode: ${config.mode || "solo"}`);
    console.log(
      `  Centralized rule management: ${config.sync?.centralized !== false ? "enabled" : "disabled"}`,
    );
    console.log(`  Merge strategy: last-write-wins (automatic)`);
    console.log(`  Exporters: ${config.exporters?.join(", ") || "none"}`);

    if (config.mode === "team") {
      console.log(
        `  Lockfile: ${config.modules?.lockfile ? "enabled" : "disabled"} (${config.lockfile?.mode || "soft"} mode)`,
      );
      console.log(
        `  Bundle: ${config.modules?.bundle ? "enabled" : "disabled"}`,
      );
    }

    if (config.managed?.sections && config.managed.sections.length > 0) {
      console.log(`  Team-managed sections: ${config.managed.sections.length}`);
      config.managed.sections.forEach((s) => console.log(`    - ${s}`));
    }

    console.log("\nTo change settings:");
    console.log("  Edit: .aligntrue/config.yaml");
    console.log("  Or run: aligntrue config edit");
  } catch (err) {
    clack.log.error(
      `Failed to load configuration: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * Get a single config value using dot notation
 */
async function configGet(configPath: string, key: string): Promise<void> {
  try {
    const content = readFileSync(configPath, "utf-8");
    const config = parseYaml(content) as Record<string, unknown>;

    const value = getNestedValue(config, key);

    if (value === undefined) {
      if (key === "mode") {
        clack.log.error(`Key not found: ${key}`);
        clack.log.info(
          "\nNote: 'mode' is a runtime setting derived from your config and defaults.",
        );
        clack.log.info("Use 'aligntrue config show' to see the active mode.");
        clack.log.info("\nAvailable stored config keys:");
        listAllKeys(config).forEach((k) => clack.log.info(`  ${k}`));
        process.exit(1);
      }

      clack.log.error(`Key not found: ${key}`);
      clack.log.info("\nAvailable keys:");
      listAllKeys(config).forEach((k) => clack.log.info(`  ${k}`));
      process.exit(1);
    }

    // Output the value (JSON for objects/arrays, plain for primitives)
    if (typeof value === "object" && value !== null) {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(value);
    }
  } catch (err) {
    clack.log.error(
      `Failed to get config value: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * Valid config keys (dot notation)
 * Keys starting with "vendor." are always allowed for custom vendor data
 */
const VALID_CONFIG_KEYS = [
  "mode",
  "version",
  "profile",
  "profile.id",
  "profile.name",
  "sources",
  "exporters",
  "sync",
  "sync.edit_source",
  "sync.two_way",
  "sync.workflow_mode",
  "sync.primary_agent",
  "sync.on_conflict",
  "sync.auto_pull",
  "sync.source_files",
  "modules",
  "modules.lockfile",
  "modules.bundle",
  "modules.checks",
  "lockfile",
  "lockfile.mode",
  "git",
  "git.mode",
  "scopes",
  "managed",
  "managed.sections",
  "managed.source_url",
  "backup",
  "backup.auto_backup",
  "backup.backup_on",
  "backup.retention_days",
  "approval",
  "approval.internal",
  "approval.external",
  "resources",
  "resources.rules",
  "performance",
  "performance.max_file_size_mb",
];

/**
 * Check if a config key is valid
 */
function isValidConfigKey(key: string): boolean {
  // Allow vendor keys
  if (key.startsWith("vendor.")) {
    return true;
  }

  // Check exact match
  if (VALID_CONFIG_KEYS.includes(key)) {
    return true;
  }

  // Check if it's a nested key under a valid parent
  // e.g., "sources.0.type" is valid if "sources" is valid
  const parts = key.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parentKey = parts.slice(0, i).join(".");
    if (VALID_CONFIG_KEYS.includes(parentKey)) {
      return true;
    }
  }

  return false;
}

/**
 * Set a config value with validation
 */
async function configSet(
  configPath: string,
  key: string,
  value: string,
): Promise<void> {
  try {
    // Validate key before setting
    if (!isValidConfigKey(key)) {
      clack.log.error(`Invalid config key: ${key}`);
      clack.log.info("\nValid keys:");
      VALID_CONFIG_KEYS.slice(0, 20).forEach((k) => clack.log.info(`  ${k}`));
      if (VALID_CONFIG_KEYS.length > 20) {
        clack.log.info(`  ... and ${VALID_CONFIG_KEYS.length - 20} more`);
      }
      clack.log.info("\nVendor keys (vendor.*) are also allowed");
      clack.log.info(
        "\nRun 'aligntrue config list' to see all current config keys",
      );
      process.exit(2);
    }

    const content = readFileSync(configPath, "utf-8");
    const config = parseYaml(content) as Record<string, unknown>;

    // Parse value (try JSON first, then treat as string)
    let parsedValue: unknown = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // If not valid JSON, treat as string
      // Special handling for booleans and numbers
      if (value === "true") parsedValue = true;
      else if (value === "false") parsedValue = false;
      else if (value === "null") parsedValue = null;
      else if (!isNaN(Number(value)) && value.trim() !== "")
        parsedValue = Number(value);
    }

    // Set the value
    setNestedValue(config, key, parsedValue);

    // Validate the config (skip for vendor keys which are always allowed)
    if (!key.startsWith("vendor.")) {
      await validateConfig(config as unknown as AlignTrueConfig);
    }

    // Write back to file
    const yamlContent = stringifyYaml(config, {
      indent: 2,
      lineWidth: 0,
      // Use YAML defaults for string types (no unnecessary quoting)
    });
    writeFileSync(configPath, yamlContent, "utf-8");

    clack.log.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
  } catch (err) {
    clack.log.error(
      `Failed to set config value: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * List all config values as key-value pairs
 */
async function configList(configPath: string): Promise<void> {
  try {
    const content = readFileSync(configPath, "utf-8");
    const config = parseYaml(content) as Record<string, unknown>;

    const keys = listAllKeys(config);

    console.log("Configuration values:");
    keys.forEach((key) => {
      const value = getNestedValue(config, key);
      const displayValue =
        typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value);
      console.log(`  ${key} = ${displayValue}`);
    });
  } catch (err) {
    clack.log.error(
      `Failed to list config: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * Unset (remove) a config value
 */
async function configUnset(configPath: string, key: string): Promise<void> {
  try {
    const content = readFileSync(configPath, "utf-8");
    const config = parseYaml(content) as Record<string, unknown>;

    const existed = deleteNestedValue(config, key);

    if (!existed) {
      clack.log.warn(`Key not found: ${key}`);
      process.exit(0);
    }

    // Validate the config after removal
    await validateConfig(config as unknown as AlignTrueConfig);

    // Write back to file
    const yamlContent = stringifyYaml(config, {
      indent: 2,
      lineWidth: 0,
      defaultStringType: "QUOTE_DOUBLE",
    });
    writeFileSync(configPath, yamlContent, "utf-8");

    clack.log.success(`Removed ${key}`);
  } catch (err) {
    clack.log.error(
      `Failed to unset config value: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

/**
 * Get nested value using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set nested value using dot notation
 * Handles array indices (e.g., "sources.0.type")
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = path.split(".");
  let current: Record<string, unknown> | unknown[] = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    const nextKey = keys[i + 1];

    // Prevent prototype pollution by checking for unsafe keys
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`Invalid key: ${key}`);
    }

    // Check if next key is a numeric index
    const isNextKeyArrayIndex = nextKey !== undefined && /^\d+$/.test(nextKey);

    // If current key doesn't exist or is wrong type, create appropriate structure
    const currentValue = Array.isArray(current)
      ? current[parseInt(key, 10)]
      : // Safe: Prototype pollution prevented by explicit __proto__/constructor/prototype checks above (lines 569-571)
        (current as Record<string, unknown>)[key];
    if (!currentValue || typeof currentValue !== "object") {
      if (isNextKeyArrayIndex) {
        // Next key is array index, create array
        if (Array.isArray(current)) {
          const idx = parseInt(key, 10);
          while (current.length <= idx) current.push(undefined);
          current[idx] = [];
        } else {
          // Safe: Prototype pollution prevented by explicit __proto__/constructor/prototype checks above (lines 569-571)
          (current as Record<string, unknown>)[key] = [];
        }
      } else {
        // Next key is object key, create object
        if (Array.isArray(current)) {
          const idx = parseInt(key, 10);
          while (current.length <= idx) current.push(undefined);
          current[idx] = {};
        } else {
          // Safe: Prototype pollution prevented by explicit __proto__/constructor/prototype checks above (lines 569-571)
          (current as Record<string, unknown>)[key] = {};
        }
      }
    } else if (isNextKeyArrayIndex && !Array.isArray(currentValue)) {
      // Current value exists but is not an array, convert it
      if (Array.isArray(current)) {
        const idx = parseInt(key, 10);
        current[idx] = [];
      } else {
        // Safe: Prototype pollution prevented by explicit __proto__/constructor/prototype checks above (lines 569-571)
        (current as Record<string, unknown>)[key] = [];
      }
    }

    // If current key is numeric, we're indexing into an array
    if (/^\d+$/.test(key)) {
      const index = parseInt(key, 10);
      const arr = current as unknown[];

      // Expand array if needed
      while (arr.length <= index) {
        arr.push(isNextKeyArrayIndex ? [] : {});
      }

      current = arr[index] as Record<string, unknown> | unknown[];
    } else {
      current = (current as Record<string, unknown>)[key] as
        | Record<string, unknown>
        | unknown[];
    }
  }

  const lastKey = keys[keys.length - 1]!;
  // Prevent prototype pollution on final key
  if (
    lastKey === "__proto__" ||
    lastKey === "constructor" ||
    lastKey === "prototype"
  ) {
    throw new Error(`Invalid key: ${lastKey}`);
  }

  // Set the final value
  if (/^\d+$/.test(lastKey)) {
    const index = parseInt(lastKey, 10);
    const arr = current as unknown[];
    while (arr.length <= index) {
      arr.push(undefined);
    }
    arr[index] = value;
  } else {
    (current as Record<string, unknown>)[lastKey] = value;
  }
}

/**
 * Delete nested value using dot notation
 * Returns true if the key existed, false otherwise
 */
function deleteNestedValue(
  obj: Record<string, unknown>,
  path: string,
): boolean {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (!(key in current) || typeof current[key] !== "object") {
      return false;
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1]!;
  if (lastKey in current) {
    delete current[lastKey];
    return true;
  }
  return false;
}

/**
 * List all keys in config (flattened with dot notation)
 */
function listAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...listAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Validate config (basic validation)
 */
async function validateConfig(config: AlignTrueConfig): Promise<void> {
  // Basic validation - ensure required fields exist
  if (!config.mode) {
    throw new Error("Missing required field: mode");
  }

  if (!["solo", "team", "enterprise"].includes(config.mode)) {
    throw new Error(
      `Invalid mode: ${config.mode}. Must be one of: solo, team, enterprise`,
    );
  }

  // Validate exporters if present
  if (config.exporters && !Array.isArray(config.exporters)) {
    throw new Error("exporters must be an array");
  }

  // More validation can be added here as needed
}
