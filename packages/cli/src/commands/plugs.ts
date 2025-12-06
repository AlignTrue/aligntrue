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
  patchConfig,
  type AlignTrueConfig,
  loadIRAndResolvePlugs,
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
    description: "Experimental: list, resolve, and validate plugs in rules",
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
    exitWithError(
      {
        title: "Subcommand required",
        message: "Provide one of: list, resolve, validate, set, unset",
        hint: "Run 'aligntrue plugs --help' for usage",
      },
      2,
    );
  }

  const validSubcommands = ["list", "resolve", "validate", "set", "unset"];
  if (!validSubcommands.includes(subcommand)) {
    console.error(`Error: Unknown subcommand "${subcommand}"\n`);
    console.error("Valid subcommands: list, resolve, validate, set, unset\n");
    console.error("Run 'aligntrue plugs --help' for more information\n");
    exitWithError(
      {
        title: "Unknown subcommand",
        message: `Unknown subcommand "${subcommand}"`,
        hint: "Valid: list, resolve, validate, set, unset",
      },
      2,
    );
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
 * Detect plug references in rule content
 * Returns array of plug keys found in [[plug:key]] syntax
 */
function detectPlugReferences(align: Align): string[] {
  const plugPattern = /\[\[plug:([a-z0-9._-]+)\]\]/g;
  const foundPlugs = new Set<string>();

  for (const section of align.sections) {
    if (section.content) {
      const matches = Array.from(section.content.matchAll(plugPattern));
      for (const match of matches) {
        if (match[1]) {
          foundPlugs.add(match[1]);
        }
      }
    }
  }

  return Array.from(foundPlugs);
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

  // Detect plug references in content
  const plugReferences = detectPlugReferences(align);

  // Show message if no plugs defined AND no config fills
  if (!align.plugs && Object.keys(configFills).length === 0) {
    // Check if there are plug references without slot definitions
    if (plugReferences.length > 0) {
      console.log("│  ⚠ Found plug references without slot definitions:\n│");
      for (const ref of plugReferences) {
        console.log(`│    [[plug:${ref}]]`);
      }
      console.log("│");
      console.log(
        "│  To use plugs, define slots in rule files (.aligntrue/rules/*.md):\n│",
      );
      console.log("│  Example YAML frontmatter in a rule file:\n│");
      console.log("│    ---");
      console.log("│    title: my-rules");
      console.log("│    plugs:");
      console.log("│      slots:");
      for (const ref of plugReferences.slice(0, 3)) {
        console.log(`│        ${ref}:`);
        console.log(`│          description: "Description for ${ref}"`);
        console.log(`│          format: text`);
        console.log(`│          required: true`);
      }
      if (plugReferences.length > 3) {
        console.log(`│        # ... and ${plugReferences.length - 3} more`);
      }
      console.log("│    ---");
      console.log("│");
      console.log("│  Then set fill values via CLI (saves to config.yaml):\n│");
      console.log(
        `│    aligntrue plugs set ${plugReferences[0] || "slot.name"} "value"`,
      );
      console.log("│");
    } else {
      console.log("│  No plugs defined\n│");
      console.log(
        "│  Plugs allow parameterizing rules with configurable values.\n│",
      );
      console.log("│  To use plugs:\n│");
      console.log("│  1. Add [[plug:key]] placeholders in your rules");
      console.log(
        "│  2. Define slots in rule files (.aligntrue/rules/*.md) using YAML frontmatter",
      );
      console.log(
        "│  3. Set fill values via 'aligntrue plugs set key value'\n│",
      );
      console.log("│  Learn more: aligntrue.ai/docs/02-customization/plugs\n│");
    }
    console.log("└  ✓ Complete\n");
    return;
  }

  // List slots
  if (align.plugs?.slots && Object.keys(align.plugs.slots).length > 0) {
    console.log("◆  Slots\n│");
    for (const [slotName, slotDef] of Object.entries(align.plugs.slots)) {
      const isRequired = Boolean(slotDef.required);
      const required = isRequired ? "required" : "optional";
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
      } else if (isRequired) {
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
      exitWithError(
        {
          title: "Plug resolution failed",
          message: "Review the errors above and fix unresolved plugs.",
        },
        1,
      );
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
    exitWithError(
      {
        title: "Failed to resolve plugs",
        message: error instanceof Error ? error.message : String(error),
      },
      1,
    );
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

  // Check if plugs are used in rules using [[plug:key]] syntax
  const usedPlugs = detectPlugReferences(align);

  // Check for undeclared plugs used in rules
  for (const plugName of usedPlugs) {
    const isDeclared = align.plugs.slots && align.plugs.slots[plugName];
    if (!isDeclared) {
      errors.push(
        `Plug "[[plug:${plugName}]]" used in rules but not declared as a slot`,
      );
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
    exitWithError(
      {
        title: "Plug validation failed",
        message: "Resolve the errors above before continuing.",
      },
      1,
    );
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
    exitWithError(
      {
        title: "Invalid arguments",
        message: "'plugs set' requires <slot> and <value>",
        hint: "Usage: aligntrue plugs set <slot> <value>",
      },
      2,
    );
  }

  const [slotName, fillValue] = args;
  if (!slotName || !fillValue) {
    console.error("Error: Both slot name and fill value are required\n");
    exitWithError(
      {
        title: "Slot and value required",
        message: "Both slot name and fill value are required",
      },
      2,
    );
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
        exitWithError(
          {
            title: `Validation failed for slot "${slotName}"`,
            message: validation.errors?.[0]?.message || "Invalid value",
            hint: `Expected format: ${format}`,
          },
          1,
        );
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
          exitWithError(
            {
              title: `Validation failed for slot "${slotName}"`,
              message: validation.errors?.[0]?.message || "Invalid URL",
              hint: "URLs must include protocol (e.g., https://example.com)",
            },
            1,
          );
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
          exitWithError(
            {
              title: `Validation failed for slot "${slotName}"`,
              message: validation.errors?.[0]?.message || "Invalid command",
              hint: "Commands must be relative paths (no absolute paths)",
            },
            1,
          );
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
          exitWithError(
            {
              title: `Validation failed for slot "${slotName}"`,
              message: validation.errors?.[0]?.message || "Invalid file path",
              hint: "File paths must be relative (no absolute paths)",
            },
            1,
          );
        }
      }
    }

    // Build updated plugs.fills
    const currentFills = config.plugs?.fills || {};
    const updatedFills = { ...currentFills, [slotName]: fillValue };

    // Patch config - only update plugs.fills, preserve everything else
    await patchConfig(
      {
        plugs: {
          ...config.plugs,
          fills: updatedFills,
        },
      },
      configPath,
    );

    console.log(`✓ Set plug fill: ${slotName} = "${fillValue}"\n`);
    console.log("  Run 'aligntrue sync' to apply the fill\n");
  } catch (error) {
    console.error("✗ Failed to set plug fill\n");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}\n`,
    );
    exitWithError(
      {
        title: "Failed to set plug fill",
        message: error instanceof Error ? error.message : String(error),
      },
      1,
    );
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
    exitWithError(
      {
        title: "Invalid arguments",
        message: "'plugs unset' requires <slot>",
        hint: "Usage: aligntrue plugs unset <slot>",
      },
      2,
    );
  }

  const [slotName] = args;
  if (!slotName) {
    console.error("Error: Slot name is required\n");
    exitWithError(
      { title: "Slot name required", message: "Provide the slot to unset" },
      2,
    );
  }

  try {
    // Load config
    const config = await loadConfig(configPath);

    // Check if fill exists
    if (!config.plugs?.fills?.[slotName]) {
      console.error(`✗ No fill found for slot "${slotName}"\n`);
      console.error("  Run 'aligntrue plugs list' to see configured fills\n");
      exitWithError(
        {
          title: "Fill not found",
          message: `No fill found for slot "${slotName}"`,
          hint: "Run 'aligntrue plugs list' to see configured fills",
        },
        1,
      );
    }

    // Check if this is the last fill
    const currentFills = config.plugs.fills;
    const fillKeys = Object.keys(currentFills);
    const isLastFill = fillKeys.length === 1 && fillKeys[0] === slotName;

    if (isLastFill) {
      // Remove the entire plugs section
      await patchConfig(
        { plugs: null as unknown as typeof config.plugs },
        configPath,
      );
    } else {
      // Remove just this fill key by setting it to null in the nested structure
      await patchConfig(
        {
          plugs: {
            ...config.plugs,
            fills: {
              ...currentFills,
              [slotName]: null as unknown as string,
            },
          },
        },
        configPath,
      );
    }

    console.log(`✓ Removed plug fill: ${slotName}\n`);
    console.log("  Run 'aligntrue sync' to apply changes\n");
  } catch (error) {
    console.error("✗ Failed to unset plug fill\n");
    console.error(
      `  ${error instanceof Error ? error.message : String(error)}\n`,
    );
    exitWithError(
      {
        title: "Failed to unset plug fill",
        message: error instanceof Error ? error.message : String(error),
      },
      1,
    );
  }
}
