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
  md,
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
  pull,
  link,
  drift,
  update,
  plugs,
  onboard,
  override,
} from "./commands/index.js";

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
    console.log("  adapters       Manage exporters (list, enable, disable)");
    console.log("  md             Markdown validation and formatting\n");

    console.log("Team Commands:");
    console.log(
      "  team           Team mode management (enable, status, approve, list-allowed, remove)",
    );
    console.log("  pull           Pull rules from git repository");
    console.log("  link           Vendor rules with git submodule/subtree");
    console.log("  drift          Detect drift from allowed sources");
    console.log("  update         Check and apply updates (check, apply)");
    console.log("  onboard        Generate developer onboarding checklist");
    console.log("  scopes         List configured scopes");
    console.log(
      "  override       Manage overlays for fork-safe customization (add, status, diff, remove)\n",
    );

    console.log("Plugs Management:");
    console.log(
      "  plugs          Manage plug slots and fills (audit, resolve, set)\n",
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

  // Handle implemented commands
  if (command === "init") {
    await init(commandArgs);
    return;
  }

  if (command === "migrate") {
    await migrate(commandArgs);
    return;
  }

  if (command === "md") {
    await md(commandArgs);
    return;
  }

  if (command === "sync") {
    await sync(commandArgs);
    return;
  }

  if (command === "watch") {
    await watch(commandArgs);
    return;
  }

  if (command === "team") {
    await team(commandArgs);
    return;
  }

  if (command === "telemetry") {
    await telemetry(commandArgs);
    return;
  }

  if (command === "scopes") {
    await scopes(commandArgs);
    return;
  }

  if (command === "check") {
    await check(commandArgs);
    return;
  }

  if (command === "config") {
    await config(commandArgs);
    return;
  }

  if (command === "adapters") {
    await adapters(commandArgs);
    return;
  }

  if (command === "privacy") {
    await privacy(commandArgs);
    return;
  }

  if (command === "backup") {
    await backup(commandArgs);
    return;
  }

  if (command === "revert") {
    await revert(commandArgs);
    return;
  }

  if (command === "plugs") {
    await plugs(commandArgs);
    return;
  }

  if (command === "pull") {
    await pull(commandArgs);
    return;
  }

  if (command === "link") {
    await link(commandArgs);
    return;
  }

  if (command === "drift") {
    await drift(commandArgs);
    return;
  }

  if (command === "update") {
    await update(commandArgs);
    return;
  }

  if (command === "onboard") {
    await onboard(commandArgs);
    return;
  }

  if (command === "override") {
    await override(commandArgs);
    return;
  }

  console.error(`Command not implemented: ${command}`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
