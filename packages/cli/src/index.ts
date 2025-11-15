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
  telemetry,
  scopes,
  check,
  config,
  adapters,
  privacy,
  backup,
  revert,
  watch,
  link,
  drift,
  update,
  plugs,
  onboard,
  override,
  sources,
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

    console.log("Basic Commands:");
    console.log("  init           Initialize AlignTrue in current directory");
    console.log("  sync           Sync rules to agents");
    console.log("  watch          Watch files and auto-sync on changes");
    console.log("  check          Validate rules and configuration\n");

    console.log("Development Commands:");
    console.log("  adapters       Manage exporters (list, enable, disable)\n");

    console.log("Organization Commands:");
    console.log(
      "  sources        Manage multi-file rule organization (list, split)",
    );
    console.log("  scopes         Manage scopes (list, discover)\n");

    console.log("Team Commands:");
    console.log(
      "  team           Team mode management (enable, disable, status)",
    );
    console.log("  link           Vendor rules with git submodule/subtree");
    console.log("  drift          Detect drift from allowed sources");
    console.log("  update         Check and apply updates (check, apply)");
    console.log("  onboard        Generate developer onboarding checklist");
    console.log(
      "  override       Manage overlays for fork-safe customization (add, status, diff, remove)\n",
    );

    console.log("Plugs Management:");
    console.log(
      "  plugs          Manage plug slots and fills (list, resolve, validate)\n",
    );

    console.log("Settings:");
    console.log("  config         View or edit configuration (show, edit)");
    console.log(
      "  backup         Manage backups (create, list, restore, cleanup)",
    );
    console.log("  revert         Restore files from backup with preview");
    console.log("  telemetry      Telemetry settings (on, off, status)");
    console.log(
      "  privacy        Privacy and consent management (audit, revoke)",
    );
    console.log("  migrate        Schema migration (run --help for policy)\n");

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
    ["watch", watch],
    ["team", team],
    ["telemetry", telemetry],
    ["scopes", scopes],
    ["check", check],
    ["config", config],
    ["adapters", adapters],
    ["privacy", privacy],
    ["backup", backup],
    ["revert", revert],
    ["plugs", plugs],
    ["link", link],
    ["drift", drift],
    ["update", update],
    ["onboard", onboard],
    ["override", override],
    ["sources", sources],
  ]);

  if (command) {
    const handler = COMMANDS.get(command);
    if (handler) {
      await handler(commandArgs);
      return;
    }
  }

  console.error(`Command not implemented: ${command || "(none)"}`);
  process.exit(1);
}

main().catch((err) => {
  // Handle AlignTrue errors with proper formatting
  if (err instanceof AlignTrueError) {
    console.error(`\n✗ ${err.message}`);
    if (err.hint) {
      console.error(`\n💡 Hint: ${err.hint}`);
    }
    console.error("");
    process.exit(err.exitCode);
  }

  // Handle unknown errors
  console.error("\n✗ Fatal error:", err.message);
  if (err.stack) {
    console.error("\nStack trace:");
    console.error(err.stack);
  }
  console.error("");
  process.exit(1);
});
