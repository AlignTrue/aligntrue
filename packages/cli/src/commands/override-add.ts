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
  getAlignTruePaths,
  loadIR,
  evaluateSelector,
} from "@aligntrue/core";
import type { AlignPack } from "@aligntrue/schema";
import * as clack from "@clack/prompts";
import { resolve } from "path";
import { isTTY } from "../utils/tty-helper.js";
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
      description: "Add an overlay to customize rules without forking",
      usage: "aligntrue override add --selector <string> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "# Override a rule by ID (if rule has an id field)",
        "aligntrue override add --selector 'rule[id=typescript-strict]' --set severity=error",
        "",
        "# Target section by array index",
        "aligntrue override add --selector 'sections[0]' --set severity=warn",
        "",
        "# Change a top-level property",
        "aligntrue override add --selector 'profile.version' --set value=2.0.0",
        "",
        "# Remove a property from a section by index",
        "aligntrue override add --selector 'sections[2]' --remove autofix",
        "",
        "# Multiple operations at once",
        "aligntrue override add --selector 'sections[1]' --set severity=warn --remove applies_to",
      ],
      notes: [
        "Quick start: Run 'aligntrue override selectors' first to copy a valid selector for your current rules.",
        "",
        "Selector Syntax:",
        "  - rule[id=value]          Target rule by ID (if rule has id field)",
        "  - sections[0]             Target section by array index",
        "  - property.path           Target a top-level property",
        "",
        "Important:",
        "  - Rules in IR are stored in a sections array without explicit IDs by default",
        "  - Use array index selectors (sections[0], sections[1], etc.) to target specific sections",
        "  - To find the index, check .aligntrue/.rules.yaml and count sections from 0",
        "  - Property paths use dot notation (e.g., profile.version, sync.workflow_mode)",
        "  - Run 'aligntrue override selectors' to list available selectors based on the current IR",
        "",
        "Common Use Cases:",
        "  - Override severity levels for specific sections by index",
        "  - Customize section properties without modifying source",
        "  - Remove unwanted properties from inherited rules",
        "",
        "Changes are saved to .aligntrue/config.yaml and applied during sync.",
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
    if (isTTY()) {
      clack.log.error(
        `Failed to add overlay: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    } else {
      console.error(
        `Error: Failed to add overlay: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
    process.exit(1);
    return;
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
    console.log("\nValid selector formats:");
    console.log("  - sections[heading=Name]  (target section by heading)");
    console.log("  - sections[0]             (target section by index)");
    console.log("  - property.path           (target top-level property)");
    console.log("\nExamples:");
    console.log(
      "  aligntrue override add --selector 'sections[heading=Security]' --set severity=error",
    );
    console.log(
      "  aligntrue override add --selector 'profile.version' --set value=2.0.0",
    );
    console.log(
      "\nTip: Run 'aligntrue override selectors' to list available selectors from your rules file.",
    );
    console.log("\nFor more help: aligntrue override add --help");
    process.exit(1);
    return;
  }

  // Parse selector to verify it's well-formed
  const parsed = parseSelector(options.selector);
  if (!parsed) {
    clack.log.error(`Could not parse selector: ${options.selector}`);
    process.exit(1);
    return;
  }

  // At least one operation required
  if (!options.set && !options.remove) {
    clack.log.error("At least one of --set or --remove is required");
    console.log("\nExamples:");
    console.log("  --set severity=error");
    console.log("  --remove autofix");
    console.log("  --set severity=warn --remove autofix");
    process.exit(1);
    return;
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
        return;
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
  const cwd = process.cwd();
  const config = await loadConfig(configPath, cwd);

  // Load IR to validate selector against
  const ir = await loadIrForValidation(config, cwd);
  if (!ir) {
    clack.log.error(
      "Could not load .aligntrue/.rules.yaml to validate selector. Run 'aligntrue sync' first.",
    );
    process.exit(1);
    return;
  }

  const selectorResult = evaluateSelector(options.selector, ir);
  if (!selectorResult.success) {
    clack.log.error(
      `Selector did not match the current rules: ${selectorResult.error ?? "unknown error"}`,
    );
    console.log(
      "\nTip: Use 'aligntrue override selectors' to list valid selectors for your current rules, or verify the ID/index in .aligntrue/.rules.yaml.",
    );
    process.exit(1);
    return;
  }

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

async function loadIrForValidation(
  config: Awaited<ReturnType<typeof loadConfig>>,
  cwd: string,
): Promise<AlignPack | null> {
  try {
    const paths = getAlignTruePaths(cwd);
    const sourcePath = config.sources?.[0]?.path || paths.rules;
    const absoluteSourcePath = resolve(cwd, sourcePath);
    const ir = await loadIR(absoluteSourcePath);
    if (ir && typeof ir === "object" && "sections" in ir) {
      return ir as AlignPack;
    }
    return null;
  } catch {
    return null;
  }
}
