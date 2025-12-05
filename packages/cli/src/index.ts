#!/usr/bin/env node

/**
 * AlignTrue CLI - Main entry point
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildCommandRegistry, generateHelpText } from "./commands/manifest.js";
import { exitWithError } from "./utils/command-utilities.js";
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
    return;
  }

  // Handle help flag or no args
  if (args.length === 0 || args[0] === "--help") {
    console.log(generateHelpText());
    return;
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  // Build command registry from manifest
  const COMMANDS = buildCommandRegistry();

  // Check if user provided a flag-like argument as command
  if (command && (command.startsWith("--") || command.startsWith("-"))) {
    exitWithError(2, `Unknown flag: ${command}`, {
      hint: "Run 'aligntrue --help' to see available commands and options",
    });
  }

  if (command) {
    const handler = COMMANDS.get(command);
    if (handler) {
      await handler(commandArgs);
      return;
    }
  }

  exitWithError(2, `Command not implemented: ${command || "(none)"}`, {
    hint: "Run 'aligntrue --help' to see available commands and options",
  });
}

main().catch((err) => {
  const systemErrorCodes = new Set([
    "EACCES",
    "EPERM",
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "EPIPE",
    "ETIMEDOUT",
  ]);

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
  const errno = err as NodeJS.ErrnoException;
  const code = errno?.code;

  let exitCode = 1;
  let hint: string | undefined;

  if (code && systemErrorCodes.has(code)) {
    exitCode = 3;

    if (code === "EACCES" || code === "EPERM") {
      const targetPath = (errno as NodeJS.ErrnoException)?.path;
      hint = targetPath
        ? `Ensure you have write permission to ${targetPath} or run from a writable directory.`
        : "Ensure you have write permission to this location or run from a writable directory.";
    } else if (code === "ECONNREFUSED" || code === "EHOSTUNREACH") {
      hint = "Check network connectivity or remote availability, then retry.";
    }
  }

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

  if (hint) {
    console.error(`\nHint: ${hint}`);
  }

  console.error("");
  process.exit(exitCode);
});
