/**
 * Command: aln override remove
 * Remove an overlay
 * Overlays system: Migrated to CLI framework
 */

import { loadConfig, saveConfigAuto } from "@aligntrue/core";
import * as clack from "@clack/prompts";
import { isTTY } from "../utils/tty-helper.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { CommonErrors } from "../utils/common-errors.js";
import { exitWithError } from "../utils/error-formatter.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--force",
    hasValue: false,
    description: "Skip confirmation",
  },
  {
    flag: "--selector",
    hasValue: true,
    description: "Selector to remove (non-interactive mode)",
  },
  {
    flag: "--all",
    hasValue: false,
    description:
      "Remove all overlays (use with --force in non-interactive mode)",
  },
  {
    flag: "--config",
    hasValue: true,
    description: "Custom config file path",
  },
];

export async function overrideRemove(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "override remove",
      description: "Remove an overlay",
      usage: "aligntrue override remove [selector] [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue override remove",
        "aligntrue override remove --selector 'rule[id=test]'",
        "aligntrue override remove --all --force",
        "aligntrue override remove --force",
      ],
      notes: [
        "If no selector provided, interactive mode will prompt for selection",
        "Use --selector in scripts or --all --force to remove every overlay",
      ],
    });
    return;
  }

  const selectorFlag = parsed.flags["selector"] as string | undefined;
  const selectorArg = selectorFlag ?? parsed.positional[0];
  const force = (parsed.flags["force"] as boolean | undefined) || false;
  const removeAll = (parsed.flags["all"] as boolean | undefined) || false;
  const config = parsed.flags["config"] as string | undefined;

  if (removeAll && selectorArg) {
    console.error("Error: --all cannot be combined with a specific selector.");
    process.exit(1);
    return;
  }

  try {
    const options: OverrideRemoveOptions = { force, removeAll };
    if (config) options.config = config;

    await runOverrideRemove(selectorArg, options);
  } catch (_error) {
    if (isTTY()) {
      clack.log.error(
        `Failed to remove overlay: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    } else {
      console.error(
        `Error: Failed to remove overlay: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }
    process.exit(1);
  }
}

interface OverrideRemoveOptions {
  force?: boolean;
  config?: string;
  removeAll?: boolean;
}

async function runOverrideRemove(
  selectorArg: string | undefined,
  options: OverrideRemoveOptions,
): Promise<void> {
  // Load config
  const configPath = options.config;
  const config = await loadConfig(configPath, process.cwd());

  // Check if any overlays exist
  const overlays = config.overlays?.overrides || [];
  if (overlays.length === 0) {
    console.log("No overlays configured");
    return;
  }

  if (options.removeAll) {
    await removeAllOverlays(config, overlays.length, options);
    return;
  }

  // Interactive mode if no selector provided
  let selectorToRemove: string;

  if (!selectorArg) {
    if (!isTTY()) {
      console.error(
        "Error: Selector argument required in non-interactive mode.",
      );
      console.error(
        "Provide a selector (aligntrue override remove 'sections[0]') or use --all --force to remove every overlay.",
      );
      process.exit(1);
      return;
    }

    // Show interactive list
    const choices = overlays.map((o, _idx) => {
      const ops: string[] = [];
      if (o.set) {
        const setPairs = Object.entries(o.set)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(", ");
        ops.push(`Set: ${setPairs}`);
      }
      if (o.remove) {
        ops.push(`Remove: ${o.remove.join(", ")}`);
      }
      return {
        value: o.selector,
        label: o.selector,
        hint: ops.join("; "),
      };
    });

    const selected = await clack.select({
      message: "Select overlay to remove",
      options: choices,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Operation cancelled");
      return;
    }

    selectorToRemove = selected as string;
  } else {
    selectorToRemove = selectorArg;
  }

  // Find matching overlay
  const matchIndex = overlays.findIndex((o) => o.selector === selectorToRemove);

  if (matchIndex === -1) {
    if (isTTY()) {
      clack.log.error(`No overlay found with selector: ${selectorToRemove}`);
    } else {
      console.error(
        `Error: No overlay found with selector: ${selectorToRemove}`,
      );
    }
    process.exit(1);
  }

  const overlayToRemove = overlays[matchIndex];

  // TypeScript strict mode: null check (should never happen due to matchIndex check)
  if (!overlayToRemove) {
    throw new Error(
      `Overlay not found at index ${matchIndex} (this should never happen)`,
    );
  }

  // Confirm removal (unless --force)
  if (!options.force) {
    console.log("\nRemove overlay: " + overlayToRemove.selector + "?");
    if (overlayToRemove.set) {
      const setPairs = Object.entries(overlayToRemove.set)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ");
      console.log(`  Set: ${setPairs}`);
    }
    if (overlayToRemove.remove) {
      console.log(`  Remove: ${overlayToRemove.remove.join(", ")}`);
    }

    if (!isTTY()) {
      exitWithError(CommonErrors.nonInteractiveConfirmation("--force"), 1);
    }

    const confirmed = await clack.confirm({
      message: "Proceed?",
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Operation cancelled");
      return;
    }
  }

  // Remove overlay
  config.overlays!.overrides!.splice(matchIndex, 1);

  // Save config
  await saveConfigAuto(config, configPath);

  // Success output
  clack.log.success("Overlay removed");
  console.log("");
  console.log("Next step:");
  console.log("  Run: aligntrue sync");
}

async function removeAllOverlays(
  config: Awaited<ReturnType<typeof loadConfig>>,
  count: number,
  options: OverrideRemoveOptions,
): Promise<void> {
  if (!options.force) {
    if (!isTTY()) {
      exitWithError(CommonErrors.nonInteractiveConfirmation("--force"), 1);
      return;
    }

    const confirmed = await clack.confirm({
      message: `Remove all overlays (${count})?`,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Operation cancelled");
      return;
    }
  }

  if (config.overlays?.overrides) {
    config.overlays.overrides = [];
  }

  await saveConfigAuto(config, options.config);
  clack.log.success(
    `Removed all overlays${count > 0 ? ` (${count} removed)` : ""}`,
  );
  console.log("");
  console.log("Next step:");
  console.log("  Run: aligntrue sync");
}
