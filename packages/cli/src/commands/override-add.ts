/**
 * Command: aln override add
 * Add an overlay to customize rules without forking
 * Overlays system: Migrated to CLI framework
 */

import {
  parseSelector,
  validateSelector,
  loadConfig,
  patchConfig,
  getAlignTruePaths,
  loadIR,
  evaluateSelector,
} from "@aligntrue/core";
import type { Align } from "@aligntrue/schema";
import * as clack from "@clack/prompts";
import { existsSync } from "fs";
import { isTTY } from "../utils/tty-helper.js";
import {
  parseCommonArgs,
  showStandardHelp,
  exitWithError,
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

function normalizeSet(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = value[key] as unknown;
      return acc;
    }, {});
}

function normalizeRemove(value: string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return [...value].sort();
}

function overlaysEqual(
  a: { selector: string; set?: Record<string, unknown>; remove?: string[] },
  b: { selector: string; set?: Record<string, unknown>; remove?: string[] },
): boolean {
  if (a.selector !== b.selector) return false;

  const normalizedASet = normalizeSet(a.set);
  const normalizedBSet = normalizeSet(b.set);
  if (JSON.stringify(normalizedASet) !== JSON.stringify(normalizedBSet)) {
    return false;
  }

  const normalizedARemove = normalizeRemove(a.remove);
  const normalizedBRemove = normalizeRemove(b.remove);
  return (
    JSON.stringify(normalizedARemove) === JSON.stringify(normalizedBRemove)
  );
}

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
        "  - To find the index, check .aligntrue/rules/ and count sections from 0",
        "  - Property paths use dot notation (e.g., profile.version, sync.scope_prefixing)",
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

  if (!selector) {
    const positional = parsed.positional?.[0];
    const messageParts = [
      "Missing --selector. Provide a selector with --selector '<value>' (quote to avoid shell globbing).",
    ];
    if (positional) {
      messageParts.push(
        `Example: aligntrue override add --selector '${positional}' --set severity=warn`,
      );
    } else {
      messageParts.push(
        "Examples:",
        "  aligntrue override add --selector 'rule[id=testing]' --set severity=warn",
        "  aligntrue override add --selector 'sections[0]' --set enabled=false",
      );
    }

    clack.log.error(messageParts.join("\n"));
    exitWithError(1, "Missing required --selector flag", {
      hint: "Pass the selector with --selector '<value>'",
    });
  }

  // Collect all --set and --remove values
  const setValues: string[] = [];
  const removeValues: string[] = [];

  // Parse raw args to collect multiple --set and --remove values
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--set") {
      const next = args[i + 1];
      if (!next) {
        exitWithError(1, "--set requires a value", {
          hint: "Expected format: --set key=value",
        });
      }
      setValues.push(next);
      i++;
    } else if (arg === "--remove") {
      const next = args[i + 1];
      if (!next) {
        exitWithError(1, "--remove requires a value", {
          hint: "Expected format: --remove key",
        });
      }
      removeValues.push(next);
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
    exitWithError(
      1,
      `Failed to add overlay: ${_error instanceof Error ? _error.message : String(_error)}`,
    );
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
    exitWithError(1, `Invalid selector: ${validation.error}`, {
      hint: "Run 'aligntrue override selectors' to view valid options",
    });
  }

  // Parse selector to verify it's well-formed
  const parsed = parseSelector(options.selector);
  if (!parsed) {
    clack.log.error(`Could not parse selector: ${options.selector}`);
    exitWithError(1, `Could not parse selector: ${options.selector}`);
  }

  // At least one operation required
  if (!options.set && !options.remove) {
    clack.log.error("At least one of --set or --remove is required");
    console.log("\nExamples:");
    console.log("  --set severity=error");
    console.log("  --remove autofix");
    console.log("  --set severity=warn --remove autofix");
    exitWithError(1, "At least one of --set or --remove is required");
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
        exitWithError(1, `Invalid --set format: ${item}`, {
          hint: "Expected format: key=value",
        });
      }
      const [, key, value] = match;

      // TypeScript strict mode: ensure key and value are defined
      if (!key || !value) {
        clack.log.error(`Invalid --set format: ${item}`);
        exitWithError(1, `Invalid --set format: ${item}`);
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
      "Could not load rules. The rules directory (.aligntrue/rules/) is missing or invalid.",
    );
    clack.log.info("To fix this, run: aligntrue sync");
    exitWithError(
      1,
      "Could not load rules. The rules directory is missing or invalid.",
      {
        hint: "Run: aligntrue sync",
      },
    );
  }

  const selectorResult = evaluateSelector(options.selector, ir);
  if (!selectorResult.success) {
    clack.log.error(
      `Selector did not match the current rules: ${selectorResult.error ?? "unknown error"}`,
    );
    console.log(
      "\nTip: Use 'aligntrue override selectors' to list valid selectors for your current rules, or verify the ID/index in .aligntrue/rules/.",
    );
    exitWithError(
      1,
      `Selector did not match the current rules: ${selectorResult.error ?? "unknown error"}`,
      {
        hint: "Run: aligntrue override selectors to view available selectors",
      },
    );
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

  // Build updated overlays with new override if not already present
  const existingOverrides = config.overlays.overrides || [];
  const isDuplicate = existingOverrides.some((existing) =>
    overlaysEqual(existing, overlay),
  );

  if (isDuplicate) {
    clack.log.info("Overlay already present; no changes made");
    return;
  }

  const updatedOverrides = [...existingOverrides, overlay];

  // Patch config - only update overlays, preserve everything else
  await patchConfig(
    {
      overlays: {
        ...config.overlays,
        overrides: updatedOverrides,
      },
    },
    configPath,
  );

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
): Promise<Align | null> {
  try {
    const paths = getAlignTruePaths(cwd);

    // Prioritize the rules directory (which is always at .aligntrue/rules)
    const irPath = paths.rules;

    // Check if IR file exists
    if (!existsSync(irPath)) {
      clack.log.warn(
        `Internal rules file not found at ${irPath}. Run 'aligntrue sync' first to generate it.`,
      );
      return null;
    }

    // Load and validate the IR
    const ir = await loadIR(irPath);
    if (ir && typeof ir === "object" && "sections" in ir) {
      return ir as Align;
    }

    clack.log.warn(
      `Internal rules file at ${irPath} exists but does not contain expected sections.`,
    );
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    clack.log.warn(`Failed to load internal rules file: ${errorMsg}`);
    return null;
  }
}
