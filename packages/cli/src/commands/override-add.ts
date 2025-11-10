/**
 * Command: aln override add
 * Add an overlay to customize rules without forking
 * Overlays system: Migrated to CLI framework
 */

import {
  parseSelector,
  validateSelector,
  loadConfig,
  saveConfig,
} from "@aligntrue/core";
import * as clack from "@clack/prompts";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--selector",
    hasValue: true,
    description: "Selector string (rule[id=...], property.path, array[0])",
  },
  {
    flag: "--set",
    hasValue: true,
    description: "Set property (repeatable, supports dot notation)",
  },
  {
    flag: "--remove",
    hasValue: true,
    description: "Remove property (repeatable)",
  },
  {
    flag: "--config",
    hasValue: true,
    description: "Custom config file path",
  },
];

export async function overrideAdd(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "override add",
      description: "Add an overlay to customize rules",
      usage: "aligntrue override add --selector <string> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue override add --selector 'rule[id=test]' --set severity=error",
        "aligntrue override add --selector 'profile.version' --set value=2.0.0",
        "aligntrue override add --selector 'rules[0]' --remove autofix",
      ],
      notes: [
        "Valid selector formats:",
        "  - rule[id=value]",
        "  - property.path",
        "  - array[0]",
      ],
    });
    return;
  }

  // Extract flags
  const selector = parsed.flags["selector"] as string | undefined;
  const config = parsed.flags["config"] as string | undefined;

  // Collect all --set and --remove values
  const setValues: string[] = [];
  const removeValues: string[] = [];

  // Parse raw args to collect multiple --set and --remove values
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--set" && args[i + 1]) {
      setValues.push(args[i + 1]!);
      i++;
    } else if (arg === "--remove" && args[i + 1]) {
      removeValues.push(args[i + 1]!);
      i++;
    }
  }

  try {
    const options: OverrideAddOptions = {
      selector: selector || "",
    };
    if (setValues.length > 0) options.set = setValues;
    if (removeValues.length > 0) options.remove = removeValues;
    if (config) options.config = config;

    await runOverrideAdd(options);
  } catch (_error) {
    clack.log.error(
      `Failed to add overlay: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
    process.exit(1);
  }
}

interface OverrideAddOptions {
  selector: string;
  set?: string[];
  remove?: string[];
  config?: string;
}

async function runOverrideAdd(options: OverrideAddOptions): Promise<void> {
  // Validate selector syntax
  const validation = validateSelector(options.selector);
  if (!validation.valid) {
    clack.log.error(`Invalid selector: ${validation.error}`);
    console.log("\nValid formats:");
    console.log("  - rule[id=value]");
    console.log("  - property.path");
    console.log("  - array[0]");
    process.exit(1);
  }

  // Parse selector to verify it's well-formed
  const parsed = parseSelector(options.selector);
  if (!parsed) {
    clack.log.error(`Could not parse selector: ${options.selector}`);
    process.exit(1);
  }

  // At least one operation required
  if (!options.set && !options.remove) {
    clack.log.error("At least one of --set or --remove is required");
    console.log("\nExamples:");
    console.log("  --set severity=error");
    console.log("  --remove autofix");
    console.log("  --set severity=warn --remove autofix");
    process.exit(1);
  }

  // Parse set operations
  const setOperations: Record<string, unknown> = {};
  if (options.set) {
    for (const item of options.set) {
      const match = item.match(/^([^=]+)=(.+)$/);
      if (!match) {
        clack.log.error(`Invalid --set format: ${item}`);
        console.log("\nExpected format: key=value");
        console.log("Examples:");
        console.log("  --set severity=error");
        console.log("  --set check.inputs.threshold=15");
        process.exit(1);
      }
      const [, key, value] = match;

      // TypeScript strict mode: ensure key and value are defined
      if (!key || !value) {
        clack.log.error(`Invalid --set format: ${item}`);
        process.exit(1);
      }

      // Try to parse value as JSON, fallback to string
      try {
        setOperations[key] = JSON.parse(value);
      } catch {
        setOperations[key] = value;
      }
    }
  }

  // Parse remove operations
  const removeOperations: string[] = options.remove || [];

  // Load config
  const configPath = options.config;
  const config = await loadConfig(configPath, process.cwd());

  // Ensure overlays.overrides array exists
  if (!config.overlays) {
    config.overlays = {};
  }
  if (!config.overlays.overrides) {
    config.overlays.overrides = [];
  }

  // Build overlay definition
  const overlay: {
    selector: string;
    set?: Record<string, unknown>;
    remove?: string[];
  } = {
    selector: options.selector,
  };

  if (Object.keys(setOperations).length > 0) {
    overlay.set = setOperations;
  }

  if (removeOperations.length > 0) {
    overlay.remove = removeOperations;
  }

  // Add to config
  config.overlays.overrides.push(overlay);

  // Save config
  await saveConfig(config, configPath);

  // Success output
  clack.log.success("Overlay added to config");
  console.log("");
  console.log(`Selector: ${options.selector}`);
  if (overlay.set) {
    console.log(
      `  Set: ${Object.entries(overlay.set)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ")}`,
    );
  }
  if (overlay.remove) {
    console.log(`  Remove: ${overlay.remove.join(", ")}`);
  }
  console.log("");
  console.log("Next step:");
  console.log("  Run: aligntrue sync");
}
