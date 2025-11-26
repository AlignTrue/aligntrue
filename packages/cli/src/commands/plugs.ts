/**
 * Plugs command - List, resolve, and validate plugs in rules
 *
 * Plugs allow stack-agnostic rule authoring with configurable slots and fills.
 * This command helps users understand and test plug resolution.
 */

import {
  resolvePlugsForAlign,
  validateFill,
  type PlugFormat,
  loadConfig,
  saveConfig, // saveConfig is exported from @aligntrue/core/config and re-exported via core/index
  type AlignTrueConfig,
  loadIRAndResolvePlugs,
  // This enables plugs.fills persistence to .aligntrue/config.yaml
} from "@aligntrue/core";
import type { Align } from "@aligntrue/schema";
import { tryLoadConfig } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { resolve } from "path";

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
    // Handle set/unset commands separately (don't need align)
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

    // Resolve source path
    const cwd = process.cwd();
    const source = config.sources?.[0] || {
      type: "local" as const,
      path: ".aligntrue/rules",
    };
    const sourcePath =
      source.type === "local" && source.path
        ? resolve(cwd, source.path)
        : resolve(cwd, ".aligntrue/rules");

    // Load IR using the same mechanism as sync command
    let align: Align;
    try {
      const loadOptions: Parameters<typeof loadIRAndResolvePlugs>[1] = {
        mode: config.mode,
      };
      if (config.plugs?.fills) {
        loadOptions.plugFills = config.plugs.fills;
      }
      const result = await loadIRAndResolvePlugs(sourcePath, loadOptions);

      if (!result.success || !result.ir) {
        exitWithError(
          Errors.fileWriteFailed(
            sourcePath,
            result.warnings?.join(", ") || "Failed to load IR",
          ),
          2,
        );
      }

      align = result.ir;

      // Merge config-defined slots into align.plugs if they exist
      // This allows slots to be defined in config for directory-based rules
      if (config.plugs) {
        if (!align.plugs) {
          align.plugs = {};
        }
        // Config fills are already applied by loadIRAndResolvePlugs
        // but we need to ensure they're visible in the align for listing
        if (config.plugs.fills) {
          align.plugs.fills = {
            ...align.plugs.fills,
            ...config.plugs.fills,
          };
        }
      }
    } catch (err) {
      exitWithError(
        Errors.fileWriteFailed(
          sourcePath,
          err instanceof Error ? err.message : String(err),
        ),
        2,
      );
    }

    // Execute subcommand
    switch (subcommand) {
      case "list":
        await listPlugs(align, config);
        break;
      case "resolve":
        await resolvePlugs(align, config);
        break;
      case "validate":
        await validatePlugs(align, config);
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
 * List all slots and fills in the align
 */
async function listPlugs(
  align: Align,
  config: AlignTrueConfig | null | undefined,
): Promise<void> {
  console.log("┌  Plugs in Align\n│");

  const configFills = config?.plugs?.fills || {};

  // Show message if no plugs defined AND no config fills
  if (!align.plugs && Object.keys(configFills).length === 0) {
    console.log("│  No plugs defined\n│");
    console.log("└  ✓ Complete\n");
    return;
  }

  // List slots
  if (align.plugs?.slots && Object.keys(align.plugs.slots).length > 0) {
    console.log("◆  Slots\n│");
    for (const [slotName, slotDef] of Object.entries(align.plugs.slots)) {
      const required = slotDef.required ? "required" : "optional";
      const configFill = configFills[slotName];
      const irFill = align.plugs.fills?.[slotName];
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
  const irOnlyFills = align.plugs?.fills
    ? Object.keys(align.plugs.fills).filter((key) => !align.plugs?.slots?.[key])
    : [];

  if (irOnlyFills.length > 0) {
    console.log("◆  Additional IR Fills (no declared slot)\n│");
    for (const slotName of irOnlyFills) {
      const fillValue = align.plugs?.fills?.[slotName];
      console.log(`●    ${slotName} = "${fillValue}"`);
    }
    console.log("│");
  }

  // List config-only fills (not in IR)
  const configOnlyFills = Object.keys(configFills).filter(
    (key) => !align.plugs?.fills?.[key],
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
  align: Align,
  config: AlignTrueConfig | null | undefined,
): Promise<void> {
  console.log("┌  Resolving Plugs\n│");

  if (!align.plugs) {
    console.log("│  No plugs to resolve\n│");
    console.log("└  ✓ Complete\n");
    return;
  }

  try {
    const configFills = config?.plugs?.fills || {};
    const resolved = resolvePlugsForAlign(align, configFills);

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
        if (rule.content) {
          const preview = rule.content.substring(0, 60);
          console.log(
            `│      Content: ${preview}${rule.content.length > 60 ? "..." : ""}`,
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
async function validatePlugs(
  align: Align,
  config?: AlignTrueConfig | null,
): Promise<void> {
  console.log("┌  Validating Plugs\n│");

  if (!align.plugs) {
    console.log("│  No plugs to validate\n│");
    console.log("└  ✓ Complete\n");
    return;
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required slots without fills
  if (align.plugs.slots) {
    const configFills = config?.plugs?.fills || {};

    for (const [slotName, slotDef] of Object.entries(align.plugs.slots)) {
      if (slotDef.required) {
        const configFill = configFills[slotName];
        const irFill = align.plugs.fills?.[slotName];
        const hasFill = configFill || irFill;

        if (!hasFill) {
          errors.push(`Required slot "${slotName}" has no fill`);
        }
      }
    }
  }

  // Check for fills without declared slots
  if (align.plugs.fills) {
    for (const slotName of Object.keys(align.plugs.fills)) {
      const isDeclared = align.plugs.slots && align.plugs.slots[slotName];
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
  for (const section of align.sections) {
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
    const isDeclared = align.plugs.slots && align.plugs.slots[plugName];
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
    const cwd = process.cwd();
    const source = config.sources?.[0] || {
      type: "local" as const,
      path: ".aligntrue/rules",
    };
    const sourcePath =
      source.type === "local" && source.path
        ? resolve(cwd, source.path)
        : resolve(cwd, ".aligntrue/rules");

    let align: Align;
    try {
      const setLoadOptions: Parameters<typeof loadIRAndResolvePlugs>[1] = {
        mode: config.mode,
      };
      if (config.plugs?.fills) {
        setLoadOptions.plugFills = config.plugs.fills;
      }
      const result = await loadIRAndResolvePlugs(sourcePath, setLoadOptions);

      if (!result.success || !result.ir) {
        console.error("Warning: Could not load IR to validate slot format");
        console.error("  Proceeding without format validation\n");
        align = {
          id: "empty",
          version: "1.0.0",
          spec_version: "1",
          sections: [],
        };
      } else {
        align = result.ir;
      }
    } catch {
      console.error("Warning: Could not load IR to validate slot format");
      console.error("  Proceeding without format validation\n");
      align = {
        id: "empty",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };
    }

    // Validate slot format if slot is declared
    if (align.plugs?.slots?.[slotName]) {
      const slotDef = align.plugs.slots[slotName];
      const format = (slotDef.format || "text") as PlugFormat;

      const validation = validateFill(fillValue, format);
      if (!validation.valid) {
        console.error(`✗ Validation failed for slot "${slotName}"\n`);
        console.error(`  ${validation.errors?.[0]?.message}\n`);
        console.error(`  Expected format: ${format}\n`);
        if (slotDef.example) {
          console.error(`  Example: ${slotDef.example}\n`);
        }
        process.exit(1);
      }
    } else {
      // Even if slot is not declared, validate format based on slot name conventions
      // This prevents storing invalid values that would fail later during sync

      // URL format validation for slots ending in .url, Url, or _url
      if (
        slotName.endsWith(".url") ||
        slotName.endsWith("Url") ||
        slotName.endsWith("_url")
      ) {
        const validation = validateFill(fillValue, "url");
        if (!validation.valid) {
          console.error(`✗ Validation failed for slot "${slotName}"\n`);
          console.error(`  ${validation.errors?.[0]?.message}\n`);
          console.error(`  Expected format: url\n`);
          console.error(
            `  Tip: URLs must include protocol (e.g., https://example.com)\n`,
          );
          process.exit(1);
        }
      }

      // Command format validation for slots ending in .cmd, Cmd, _cmd, .command, or _command
      if (
        slotName.endsWith(".cmd") ||
        slotName.endsWith("Cmd") ||
        slotName.endsWith("_cmd") ||
        slotName.endsWith(".command") ||
        slotName.endsWith("_command")
      ) {
        const validation = validateFill(fillValue, "command");
        if (!validation.valid) {
          console.error(`✗ Validation failed for slot "${slotName}"\n`);
          console.error(`  ${validation.errors?.[0]?.message}\n`);
          console.error(`  Expected format: command\n`);
          console.error(
            `  Tip: Commands must be relative paths (no absolute paths like /usr/bin/...)\n`,
          );
          process.exit(1);
        }
      }

      // File format validation for slots ending in .file, File, _file, .path, or _path
      if (
        slotName.endsWith(".file") ||
        slotName.endsWith("File") ||
        slotName.endsWith("_file") ||
        slotName.endsWith(".path") ||
        slotName.endsWith("_path")
      ) {
        const validation = validateFill(fillValue, "file");
        if (!validation.valid) {
          console.error(`✗ Validation failed for slot "${slotName}"\n`);
          console.error(`  ${validation.errors?.[0]?.message}\n`);
          console.error(`  Expected format: file\n`);
          console.error(
            `  Tip: File paths must be relative (no absolute paths)\n`,
          );
          process.exit(1);
        }
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
