/**
 * Plugs command - List, resolve, and validate plugs in rules
 *
 * Plugs allow stack-agnostic rule authoring with configurable slots and fills.
 * This command helps users understand and test plug resolution.
 */

import { resolvePlugsForPack } from "@aligntrue/core";
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
    usage: "aligntrue plugs <list|resolve|validate> [options]",
    args: ARG_DEFINITIONS,
    examples: [
      "aligntrue plugs list                # List all slots and fills",
      "aligntrue plugs resolve             # Resolve plugs and show output",
      "aligntrue plugs validate            # Validate plugs",
    ],
    notes: [
      "Subcommands:",
      "  list      - List declared slots and fills",
      "  resolve   - Resolve plugs in rules and show output",
      "  validate  - Check for undeclared or unresolved plugs",
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

  const validSubcommands = ["list", "resolve", "validate"];
  if (!validSubcommands.includes(subcommand)) {
    console.error(`Error: Unknown subcommand "${subcommand}"\n`);
    console.error("Valid subcommands: list, resolve, validate\n");
    console.error("Run 'aligntrue plugs --help' for more information\n");
    process.exit(2);
  }

  const configPath = (flags["--config"] as string) || ".aligntrue/config.yaml";

  try {
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
        await listPlugs(pack);
        break;
      case "resolve":
        await resolvePlugs(pack);
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
async function listPlugs(pack: AlignPack): Promise<void> {
  console.log("┌  Plugs in Pack\n│");

  if (!pack.plugs) {
    console.log("│  No plugs defined\n│");
    console.log("└  ✓ Complete\n");
    return;
  }

  // List slots
  if (pack.plugs.slots && Object.keys(pack.plugs.slots).length > 0) {
    console.log("◆  Slots\n│");
    for (const [slotName, slotDef] of Object.entries(pack.plugs.slots)) {
      const required = slotDef.required ? "required" : "optional";
      console.log(`●    ${slotName} (${slotDef.format}, ${required})`);
      console.log(`│      ${slotDef.description}`);
      if (slotDef.example) {
        console.log(`│      Example: ${slotDef.example}`);
      }
      console.log("│");
    }
  } else {
    console.log("◆  No slots declared\n│");
  }

  // List fills
  if (pack.plugs.fills && Object.keys(pack.plugs.fills).length > 0) {
    console.log("◆  Fills\n│");
    for (const [slotName, fillValue] of Object.entries(pack.plugs.fills)) {
      console.log(`●    ${slotName} = "${fillValue}"`);
    }
    console.log("│");
  } else {
    console.log("◆  No fills provided\n│");
  }

  console.log("└  ✓ Complete\n");
}

/**
 * Resolve plugs and show the output
 */
async function resolvePlugs(pack: AlignPack): Promise<void> {
  console.log("┌  Resolving Plugs\n│");

  if (!pack.plugs) {
    console.log("│  No plugs to resolve\n│");
    console.log("└  ✓ Complete\n");
    return;
  }

  try {
    const resolved = resolvePlugsForPack(pack);

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
