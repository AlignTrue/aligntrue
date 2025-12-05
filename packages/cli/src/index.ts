#!/usr/bin/env node

/**
 * AlignTrue CLI - Main entry point
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildCommandRegistry, generateHelpText } from "./commands/manifest.js";
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

  // Handle help flag or no args
  if (args.length === 0 || args[0] === "--help") {
    console.log(generateHelpText());
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Build command registry from manifest
  const COMMANDS = buildCommandRegistry();

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
