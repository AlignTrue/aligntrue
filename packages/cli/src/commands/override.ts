/**
 * Override command - Manage overlays for customizing upstream rules
 * Phase 3.5: Fork-safe customization (Minimal v1)
 */

import * as clack from "@clack/prompts";
import {
  getAlignTruePaths,
  loadConfig,
  findStaleSelectors,
  loadIR,
} from "@aligntrue/core";

const HELP_TEXT = `
Usage: aln override <subcommand> [options]

Manage overlays for fork-safe customization of upstream rules.

Subcommands:
  status    Show current overlays and their health

Examples:
  aln override status          # Show all overlays
  aln override status --json   # JSON output

Note: 'add' and 'diff' subcommands will be implemented in Phase 3.5 Session 3.
For now, manually edit .aligntrue/config.yaml to add overlays.
`.trim();

/**
 * Main override command router
 */
export async function overrideCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    console.log(HELP_TEXT);
    return;
  }

  const cwd = process.cwd();

  try {
    switch (subcommand) {
      case "status":
        await handleStatus(cwd, args);
        break;

      case "add":
      case "diff":
        clack.log.warn(
          `'${subcommand}' subcommand not yet implemented (Phase 3.5 Session 3)`,
        );
        console.log(
          "For now, manually edit .aligntrue/config.yaml to add overlays.",
        );
        process.exit(0);
        break;

      default:
        clack.log.error(`Unknown subcommand: ${subcommand}`);
        console.log(HELP_TEXT);
        process.exit(2);
    }
  } catch (error) {
    clack.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Show overlay status
 */
async function handleStatus(cwd: string, args: string[]): Promise<void> {
  const jsonOutput = args.includes("--json");
  const paths = getAlignTruePaths(cwd);

  // Load config
  let config;
  try {
    config = await loadConfig();
  } catch (err) {
    clack.log.error(
      `Failed to load config: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  if (!config.overlays?.overrides || config.overlays.overrides.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({ overlays: [], count: 0 }, null, 2));
    } else {
      console.log("No overlays configured.");
      console.log(
        "\nTo add overlays, edit .aligntrue/config.yaml and add an 'overlays' section.",
      );
    }
    return;
  }

  // Load IR to check overlay health
  let ir;
  try {
    ir = await loadIR(paths.rules, { mode: config.mode });
  } catch {
    // IR not available - show overlays without health check
    ir = null;
  }

  const overlays = config.overlays.overrides;
  const staleSelectors = ir
    ? findStaleSelectors(
        overlays.map((o) => o.selector),
        ir,
      )
    : [];

  // JSON output
  if (jsonOutput) {
    const output = {
      overlays: overlays.map((overlay) => ({
        selector: overlay.selector,
        operations: {
          set: overlay.set ? Object.keys(overlay.set).length : 0,
          remove: overlay.remove ? overlay.remove.length : 0,
        },
        health: staleSelectors.includes(overlay.selector) ? "stale" : "ok",
      })),
      count: overlays.length,
      stale: staleSelectors.length,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  console.log(`\n📦 Overlays: ${overlays.length} configured\n`);

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    if (!overlay) continue;

    const isStale = staleSelectors.includes(overlay.selector);
    const statusIcon = isStale ? "⚠️ " : "✓";
    const statusLabel = isStale ? "(stale)" : "(ok)";

    console.log(`${i + 1}. ${statusIcon} ${overlay.selector} ${statusLabel}`);

    if (overlay.set) {
      console.log(`   Set: ${Object.keys(overlay.set).join(", ")}`);
    }
    if (overlay.remove) {
      console.log(`   Remove: ${overlay.remove.join(", ")}`);
    }
    console.log();
  }

  if (staleSelectors.length > 0) {
    console.log(
      `⚠️  ${staleSelectors.length} stale selector(s) - these may not match current IR`,
    );
  }
}
