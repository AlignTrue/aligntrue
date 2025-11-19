/**
 * Plugs command - List, resolve, and validate plugs in rules
 *
 * Plugs allow stack-agnostic rule authoring with configurable slots and fills.
 * This command helps users understand and test plug resolution.
 */

import {
  resolvePlugsForPack,
  validateFill,
  type PlugFormat,
  loadConfig,
  saveConfig,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { parseYamlToJson, type AlignPack } from "@aligntrue/schema";
import { tryLoadConfig } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { resolveSource } from "../utils/source-resolver.js";

/**
 * Argument definitions for plugs command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--config",
    description: "Path to config file (default: .aligntrue/config.yaml)",
    hasValue: true,
  },
  {
    flag: "--help",
    description: "Show help for plugs command",
    hasValue: false,
  },
];

/**
 * Show help for plugs command
 */
function showHelp() {
  showStandardHelp({
    name: "plugs",
    description: "List, resolve, and validate plugs in rules",
    usage: "aligntrue plugs <list|resolve|validate|set|unset> [options]",
    args: ARG_DEFINITIONS,
    examples: [
      "aligntrue plugs list                      # List all slots and fills",
      "aligntrue plugs resolve                   # Resolve plugs and show output",
      "aligntrue plugs validate                  # Validate plugs",
      'aligntrue plugs set test.cmd "pnpm test" # Set a fill value',
      "aligntrue plugs unset test.cmd           # Remove a fill value",
    ],
    notes: [
      "Subcommands:",
      "  list      - List declared slots and fills",
      "  resolve   - Resolve plugs in rules and show output",
      "  validate  - Check for undeclared or unresolved plugs",
      "  set       - Set a fill value for a slot",
      "  unset     - Remove a fill value for a slot",
    ],
  });
}

/**
 * Plugs command handler
 */
export async function plugsCommand(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);
  const { flags, positional, help } = parsed;

  if (help) {
    showHelp();
    process.exit(0);
  }

  const subcommand = positional[0];
  if (!subcommand) {
    console.error("Error: Subcommand required\n");
    showHelp();
    process.exit(2);
  }

  const validSubcommands = ["list", "resolve", "validate", "set", "unset"];
  if (!validSubcommands.includes(subcommand)) {
    console.error(`Error: Unknown subcommand "${subcommand}"\n`);
    console.error("Valid subcommands: list, resolve, validate, set, unset\n");
    console.error("Run 'aligntrue plugs --help' for more information\n");
    process.exit(2);
  }

  const configPath = (flags["--config"] as string) || ".aligntrue/config.yaml";

  try {
    // Handle set/unset commands separately (don't need pack)
    if (subcommand === "set") {
      await setPlugFill(positional.slice(1), configPath);
      return;
    }
    if (subcommand === "unset") {
      await unsetPlugFill(positional.slice(1), configPath);
      return;
    }

    // Load config
    const config = await tryLoadConfig(configPath);

    // Resolve source
    const source = config.sources?.[0] || {
      type: "local" as const,
      path: ".aligntrue/.rules.yaml",
    };

    let pack: AlignPack;
    try {
      const resolved = await resolveSource(source);
      pack = parseYamlToJson(resolved.content) as AlignPack;
    } catch (err) {
      exitWithError(
        Errors.fileWriteFailed(
          source.type === "local"
            ? source.path || "unknown"
            : source.url || "unknown",
          err instanceof Error ? err.message : String(err),
        ),
        2,
      );
    }

    // Execute subcommand
    switch (subcommand) {
      case "list":
        await listPlugs(pack, config);
        break;
      case "resolve":
        await resolvePlugs(pack, config);
        break;
      case "validate":
        await validatePlugs(pack);
        break;
    }
  } catch (error) {
    exitWithError(
      Errors.fileWriteFailed(
        "plugs command",
        error instanceof Error ? error.message : String(error),
      ),
      1,
    );
  }
}

/**
 * List all slots and fills in the pack
 */
async function listPlugs(
  pack: AlignPack,
  config: AlignTrueConfig | null | undefined,
): Promise<void> {
  console.log("┌  Plugs in Pack\n│");

  if (!pack.plugs) {
    console.log("│  No plugs defined\n│");
    console.log("└  ✓ Complete\n");
    return;
  }

  const configFills = config?.plugs?.fills || {};

  // List slots
  if (pack.plugs.slots && Object.keys(pack.plugs.slots).length > 0) {
    console.log("◆  Slots\n│");
    for (const [slotName, slotDef] of Object.entries(pack.plugs.slots)) {
      const required = slotDef.required ? "required" : "optional";
      const configFill = configFills[slotName];
      const irFill = pack.plugs.fills?.[slotName];
      const fill = configFill || irFill;
      const fillSource = configFill
        ? "(from config)"
        : irFill
          ? "(from IR)"
          : "(unresolved)";

      console.log(`●    ${slotName} (${slotDef.format}, ${required})`);
      console.log(`│      ${slotDef.description}`);
      if (fill) {
        console.log(`│      Fill: "${fill}" ${fillSource}`);
      } else if (required) {
        console.log(`│      ⚠ No fill provided (required)`);
      }
      if (slotDef.example) {
        console.log(`│      Example: ${slotDef.example}`);
      }
      console.log("│");
    }
  } else {
    console.log("◆  No slots declared\n│");
  }

  // List fills from IR (not shown above)
  const irOnlyFills = pack.plugs.fills
    ? Object.keys(pack.plugs.fills).filter((key) => !pack.plugs?.slots?.[key])
    : [];

  if (irOnlyFills.length > 0) {
    console.log("◆  Additional IR Fills (no declared slot)\n│");
    for (const slotName of irOnlyFills) {
      const fillValue = pack.plugs.fills![slotName];
      console.log(`●    ${slotName} = "${fillValue}"`);
    }
    console.log("│");
  }

  // List config-only fills (not in IR)
  const configOnlyFills = Object.keys(configFills).filter(
    (key) => !pack.plugs?.fills?.[key],
  );

  if (configOnlyFills.length > 0) {
    console.log("◆  Config Fills (override IR)\n│");
    for (const slotName of configOnlyFills) {
      const fillValue = configFills[slotName];
      console.log(`●    ${slotName} = "${fillValue}"`);
    }
    console.log("│");
  }

  console.log("└  ✓ Complete\n");
}

/**
 * Resolve plugs and show the output
 */
async function resolvePlugs(
  pack: AlignPack,
  config: AlignTrueConfig | null | undefined,
): Promise<void> {
  console.log("┌  Resolving Plugs\n│");

  if (!pack.plugs) {
    console.log("│  No plugs to resolve\n│");
    console.log("└  ✓ Complete\n");
    return;
  }

  try {
    const configFills = config?.plugs?.fills || {};
    const resolved = resolvePlugsForPack(pack, configFills);

    if (!resolved.success) {
      console.log("✗  Resolution failed\n│");
      if (resolved.errors && resolved.errors.length > 0) {
        console.log("◆  Errors\n│");
        for (const error of resolved.errors) {
          console.log(`●    ${error}`);
        }
        console.log("│");
      }
      if (resolved.unresolvedRequired.length > 0) {
        console.log("◆  Unresolved Required Plugs\n│");
        for (const plug of resolved.unresolvedRequired) {
          console.log(`●    {{${plug}}}`);
        }
        console.log("│");
      }
      console.log("└  ✗ Resolution incomplete\n");
      process.exit(1);
    }

    console.log("◆  Resolved Rules\n│");
    console.log(`●    Total: ${resolved.rules.length}`);
    console.log("│");

    // Show sample of resolved rules
    if (resolved.rules.length > 0) {
      console.log("◆  Sample Resolved Rules\n│");
      const sampleSize = Math.min(3, resolved.rules.length);
      for (let i = 0; i < sampleSize; i++) {
        const rule = resolved.rules[i];
        if (!rule) continue;

        console.log(`●    ${rule.ruleId}`);
        if (rule.guidance) {
          const preview = rule.guidance.substring(0, 60);
          console.log(
            `│      Guidance: ${preview}${rule.guidance.length > 60 ? "..." : ""}`,
          );
        }
        if (rule.resolutions.length > 0) {
          console.log(`│      Resolutions: ${rule.resolutions.length}`);
        }
        console.log("│");
      }
      if (resolved.rules.length > sampleSize) {
        console.log(
          `●    ... and ${resolved.rules.length - sampleSize} more rules\n│`,
        );
      }
    }

    console.log("└  ✓ Plugs resolved successfully\n");
  } catch (error) {
    console.error("✗  Failed to resolve plugs\n");
    console.error(
      `   ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}

/**
 * Validate plugs (check for undeclared or unresolved)
 */
async function validatePlugs(pack: AlignPack): Promise<void> {
  console.log("┌  Validating Plugs\n│");

  if (!pack.plugs) {
    console.log("│  No plugs to validate\n│");
    console.log("└  ✓ Complete\n");
    return;
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required slots without fills
  if (pack.plugs.slots) {
    for (const [slotName, slotDef] of Object.entries(pack.plugs.slots)) {
      if (slotDef.required) {
        const hasFill = pack.plugs.fills && pack.plugs.fills[slotName];
        if (!hasFill) {
          errors.push(`Required slot "${slotName}" has no fill`);
        }
      }
    }
  }

  // Check for fills without declared slots
  if (pack.plugs.fills) {
    for (const slotName of Object.keys(pack.plugs.fills)) {
      const isDeclared = pack.plugs.slots && pack.plugs.slots[slotName];
      if (!isDeclared) {
        warnings.push(`Fill "${slotName}" has no declared slot`);
      }
    }
  }

  // Check if plugs are used in rules
  const plugPattern = /\{\{([^}]+)\}\}/g;
  const usedPlugs = new Set<string>();

  // TODO: Extract plugs from section content in sections-only format
  // For now, skip plug extraction since sections-only format uses natural markdown
  for (const section of pack.sections) {
    if (section.content) {
      const matches = Array.from(section.content.matchAll(plugPattern));
      for (const match of matches) {
        const plugName = match[1];
        if (plugName) {
          usedPlugs.add(plugName);
        }
      }
    }
  }

  // Check for undeclared plugs used in rules
  for (const plugName of usedPlugs) {
    const isDeclared = pack.plugs.slots && pack.plugs.slots[plugName];
    if (!isDeclared) {
      errors.push(`Plug "{{${plugName}}}" used in rules but not declared`);
    }
  }

  // Report results
  if (errors.length > 0) {
    console.log("✗  Validation failed\n│");
    console.log("◆  Errors\n│");
    for (const error of errors) {
      console.log(`●    ${error}`);
    }
    console.log("│");
  }

  if (warnings.length > 0) {
    console.log("◆  Warnings\n│");
    for (const warning of warnings) {
      console.log(`●    ${warning}`);
    }
    console.log("│");
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✓  All plugs valid\n│");
  }

  console.log("└  ✓ Validation complete\n");

  if (errors.length > 0) {
    process.exit(1);
  }
}

/**
 * Set a plug fill in config
 */
async function setPlugFill(args: string[], configPath: string): Promise<void> {
  if (args.length < 2) {
    console.error("Error: 'plugs set' requires <slot> and <value> arguments\n");
    console.error("Usage: aligntrue plugs set <slot> <value>\n");
    console.error('Example: aligntrue plugs set test.cmd "pnpm test"\n');
    process.exit(2);
  }

  const [slotName, fillValue] = args;
  if (!slotName || !fillValue) {
    console.error("Error: Both slot name and fill value are required\n");
    process.exit(2);
  }

  try {
    // Load config
    const config = await loadConfig(configPath);

    // Load IR to get slot format
    const source = config.sources?.[0] || {
      type: "local" as const,
      path: ".aligntrue/.rules.yaml",
    };

    let pack: AlignPack;
    try {
      const resolved = await resolveSource(source);
      pack = parseYamlToJson(resolved.content) as AlignPack;
    } catch {
      console.error("Warning: Could not load IR to validate slot format");
      console.error("  Proceeding without format validation\n");
      pack = {
        id: "empty",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };
    }

    // Validate slot format if slot is declared
    if (pack.plugs?.slots?.[slotName]) {
      const slotDef = pack.plugs.slots[slotName];
      const format = (slotDef.format || "text") as PlugFormat;

      const validation = validateFill(fillValue, format);
      if (!validation.valid) {
        console.error(`✗ Validation failed for slot "${slotName}"\n`);
        console.error(`  ${validation.error}\n`);
        console.error(`  Expected format: ${format}\n`);
        if (slotDef.example) {
          console.error(`  Example: ${slotDef.example}\n`);
        }
        process.exit(1);
      }
    }

    // Update config
    if (!config.plugs) {
      config.plugs = {};
    }
    if (!config.plugs.fills) {
      config.plugs.fills = {};
    }
    config.plugs.fills[slotName] = fillValue;

    // Save config
    await saveConfig(config, configPath);

    console.log(`✓ Set plug fill: ${slotName} = "${fillValue}"\n`);
    console.log("  Run 'aligntrue sync' to apply the fill\n");
  } catch (error) {
    console.error("✗ Failed to set plug fill\n");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}

/**
 * Unset a plug fill in config
 */
async function unsetPlugFill(
  args: string[],
  configPath: string,
): Promise<void> {
  if (args.length < 1) {
    console.error("Error: 'plugs unset' requires <slot> argument\n");
    console.error("Usage: aligntrue plugs unset <slot>\n");
    console.error("Example: aligntrue plugs unset test.cmd\n");
    process.exit(2);
  }

  const [slotName] = args;
  if (!slotName) {
    console.error("Error: Slot name is required\n");
    process.exit(2);
  }

  try {
    // Load config
    const config = await loadConfig(configPath);

    // Check if fill exists
    if (!config.plugs?.fills?.[slotName]) {
      console.error(`✗ No fill found for slot "${slotName}"\n`);
      console.error("  Run 'aligntrue plugs list' to see configured fills\n");
      process.exit(1);
    }

    // Remove fill
    delete config.plugs.fills[slotName];

    // Clean up empty objects
    if (Object.keys(config.plugs.fills).length === 0) {
      delete config.plugs.fills;
    }
    if (config.plugs && Object.keys(config.plugs).length === 0) {
      delete config.plugs;
    }

    // Save config
    await saveConfig(config, configPath);

    console.log(`✓ Removed plug fill: ${slotName}\n`);
    console.log("  Run 'aligntrue sync' to apply changes\n");
  } catch (error) {
    console.error("✗ Failed to unset plug fill\n");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}
