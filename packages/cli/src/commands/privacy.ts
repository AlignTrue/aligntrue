/**
 * Privacy commands - manage user consent for network operations
 */

import * as clack from "@clack/prompts";
import { createConsentManager } from "@aligntrue/core";
import { exitWithError } from "../utils/error-formatter.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

/**
 * Argument definitions for privacy command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--all",
    hasValue: false,
    description: "Revoke all consents (for revoke subcommand)",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Privacy command router
 */
export async function privacyCommand(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);
  const subcommand = parsed.positional[0];

  if (!subcommand || parsed.help) {
    showStandardHelp({
      name: "privacy",
      description: "Privacy consent management",
      usage: "aligntrue privacy <subcommand> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue privacy audit",
        "aligntrue privacy revoke catalog",
        "aligntrue privacy revoke git",
        "aligntrue privacy revoke --all",
      ],
      notes: [
        "Subcommands:",
        "  audit              List all consents with timestamps",
        "  revoke <operation> Revoke specific consent (catalog/git)",
        "  revoke --all       Revoke all consents",
      ],
    });
    process.exit(0);
    return;
  }

  switch (subcommand) {
    case "audit":
      await auditCommand();
      break;
    case "revoke":
      await revokeCommand(
        parsed.positional.slice(1),
        parsed.flags["all"] as boolean | undefined,
      );
      break;
    default:
      exitWithError({
        title: "Unknown subcommand",
        message: `Unknown privacy subcommand: ${subcommand}`,
        hint: 'Run "aligntrue privacy --help" to see available commands',
        code: "ERR_UNKNOWN_COMMAND",
      });
  }
}

/**
 * Audit command - list all consents
 */
async function auditCommand(): Promise<void> {
  const manager = createConsentManager();
  const consents = manager.listConsents();

  if (consents.length === 0) {
    clack.log.info("No privacy consents granted yet");
    console.log();
    console.log("Network operations will prompt for consent when needed.");
    console.log(
      'Run "aligntrue privacy audit" after granting consent to see details.',
    );
    return;
  }

  clack.log.message("Privacy Consents");
  console.log();

  for (const consent of consents) {
    const timestamp = new Date(consent.granted_at);
    const formattedDate = timestamp.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const formattedTime = timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    console.log(
      `  ✓ ${consent.operation.padEnd(10)} Granted ${formattedDate} at ${formattedTime}`,
    );
  }

  console.log();
  console.log(`Use 'aligntrue privacy revoke <operation>' to revoke`);
}

/**
 * Revoke command - revoke consent
 */
async function revokeCommand(
  operations: string[],
  all?: boolean,
): Promise<void> {
  const manager = createConsentManager();

  // Handle --all flag
  if (all) {
    const consents = manager.listConsents();

    if (consents.length === 0) {
      clack.log.info("No consents to revoke");
      return;
    }

    // Confirm before revoking all
    const confirmed = await clack.confirm({
      message: `Revoke all ${consents.length} consent(s)?`,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Revoke cancelled");
      return;
    }

    manager.revokeAll();
    clack.log.success(`Revoked all consents (${consents.length})`);
    console.log();
    console.log(
      "Network operations will prompt for consent again when needed.",
    );
    return;
  }

  // Revoke specific operation
  const operation = operations[0];

  if (!operation) {
    exitWithError({
      title: "Missing operation",
      message: "Specify operation to revoke: catalog or git",
      hint: 'Run "aligntrue privacy revoke --all" to revoke all consents',
      code: "ERR_MISSING_ARGUMENT",
    });
    return;
  }

  if (operation !== "catalog" && operation !== "git") {
    exitWithError({
      title: "Invalid operation",
      message: `Unknown operation: ${operation}`,
      hint: "Valid operations: catalog, git",
      code: "ERR_INVALID_ARGUMENT",
    });
    return;
  }

  // Check if consent exists
  if (!manager.checkConsent(operation)) {
    clack.log.info(`No consent for '${operation}' to revoke`);
    console.log();
    console.log('Run "aligntrue privacy audit" to see all consents.');
    return;
  }

  manager.revokeConsent(operation);
  clack.log.success(`Revoked consent for '${operation}'`);
  console.log();
  console.log(`Next sync will prompt for ${operation} consent again.`);
}
