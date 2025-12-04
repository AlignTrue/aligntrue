#!/usr/bin/env node

/**
 * AlignTrue CLI - Main entry point
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  init,
  migrate,
  sync,
  team,
  scopes,
  check,
  config,
  exporters,
  privacy,
  backup,
  revert,
  drift,
  plugs,
  onboard,
  override,
  sources,
  status,
  doctor,
  add,
  remove,
  rules,
  uninstall,
} from "./commands/index.js";
import { AlignTrueError } from "./utils/error-types.js";

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8"),
);
const VERSION = packageJson.version;

async function main() {
  const args = process.argv.slice(2);

  // Handle version flag
  if (args[0] === "--version" || args[0] === "-v") {
    console.log(VERSION);
    process.exit(0);
  }

  if (args.length === 0 || args[0] === "--help") {
    console.log("AlignTrue CLI - AI-native rules and alignment platform\n");
    console.log("Usage: aligntrue <command> [options]\n");

    console.log("Getting Started:");
    console.log("  init           Initialize AlignTrue (start here)");
    console.log("  sync           Sync rules to agents");
    console.log("  status         Check current setup");
    console.log("  doctor         Run health checks");
    console.log("  onboard        Get personalized onboarding checklist\n");

    console.log("Basic Commands:");
    console.log("  init           Initialize AlignTrue in current directory");
    console.log(
      "  sync           Sync rules to agents (always backs up first)",
    );
    console.log("  check          Validate rules and configuration\n");
    console.log("Diagnostics:");
    console.log(
      "  status         Show current status, exporters, and sync health",
    );
    console.log("  doctor         Run health checks and verification tests\n");

    console.log("Basic Commands:");
    console.log("  exporters      Manage exporters (list, enable, disable)\n");

    console.log("Source Management:");
    console.log("  add            Add an align from a URL");
    console.log("  remove         Remove an align source");
    console.log(
      "  sources        Manage multi-file rule organization (list, split)",
    );
    console.log("  rules          List rules and view agent targeting");
    console.log("  scopes         Manage scopes (list, discover)\n");

    console.log("Team Commands:");
    console.log(
      "  team           Team mode management (enable, disable, status)",
    );
    console.log("  drift          Detect drift from allowed sources");
    console.log("  onboard        Generate developer onboarding checklist");
    console.log(
      "  override       Manage overlays for fork-safe customization (add, status, diff, remove)\n",
    );

    console.log("Plugs Management:");
    console.log(
      "  plugs          Manage plug slots and fills (list, resolve, validate)\n",
    );

    console.log("Safety & Settings:");
    console.log("  config         View or edit configuration (show, edit)");
    console.log(
      "  backup         Manage backups (create, list, restore, cleanup)",
    );
    console.log("  revert         Restore files from backup with preview");
    console.log(
      "  privacy        Privacy and consent management (audit, revoke)",
    );
    console.log("  migrate        Schema migration (run --help for policy)");
    console.log("  uninstall      Remove AlignTrue from this project\n");

    console.log("Run aligntrue <command> --help for command-specific options");
    console.log("Run aligntrue --version for version information");
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Command registry for clean dispatch
  const COMMANDS = new Map<string, (args: string[]) => Promise<void>>([
    ["init", init],
    ["migrate", migrate],
    ["sync", sync],
    ["team", team],
    ["scopes", scopes],
    ["check", check],
    ["config", config],
    ["exporters", exporters],
    ["privacy", privacy],
    ["backup", backup],
    ["revert", revert],
    ["plugs", plugs],
    ["drift", drift],
    ["onboard", onboard],
    ["override", override],
    ["sources", sources],
    ["status", status],
    ["doctor", doctor],
    ["add", add],
    ["remove", remove],
    ["rules", rules],
    ["uninstall", uninstall],
  ]);

  // Check if user provided a flag-like argument as command
  if (command && (command.startsWith("--") || command.startsWith("-"))) {
    console.error(`Unknown flag: ${command}`);
    console.error(
      `\nRun 'aligntrue --help' to see available commands and options`,
    );
    process.exit(1);
  }

  if (command) {
    const handler = COMMANDS.get(command);
    if (handler) {
      await handler(commandArgs);
      return;
    }
  }

  console.error(`Command not implemented: ${command || "(none)"}`);
  console.error(
    `\nRun 'aligntrue --help' to see available commands and options`,
  );
  process.exit(1);
}

main().catch((err) => {
  // Handle AlignTrue errors with proper formatting
  if (err instanceof AlignTrueError) {
    console.error(`\n✗ ${err.message}`);
    if (err.hint) {
      console.error(`\n💡 Hint: ${err.hint}`);
    }
    if (err.nextSteps && err.nextSteps.length > 0) {
      console.error("\nNext steps:");
      err.nextSteps.forEach((step) => console.error(`  - ${step}`));
    }
    console.error("");
    process.exit(err.exitCode);
  }

  // Handle unknown errors - only show stack trace in debug mode
  console.error("\n✗ Fatal error:", err.message);

  // Show stack trace only if DEBUG or VERBOSE env var is set
  const showStackTrace =
    process.env["DEBUG"] === "1" ||
    process.env["VERBOSE"] === "1" ||
    process.env["ALIGNTRUE_DEBUG"] === "1";
  if (showStackTrace && err.stack) {
    console.error("\nStack trace:");
    console.error(err.stack);
  } else if (err.stack) {
    console.error("\nRun with DEBUG=1 for full stack trace");
  }
  console.error("");
  process.exit(1);
});
