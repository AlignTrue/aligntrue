/**
 * Privacy commands - manage user consent for network operations
 */

import * as clack from "@clack/prompts";
import { createConsentManager } from "@aligntrue/core";
import { exitWithError } from "../utils/error-formatter.js";
import { isTTY } from "../utils/tty-helper.js";
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
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Skip confirmation prompts (for revoke --all)",
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
        "aligntrue privacy grant git",
        "aligntrue privacy revoke git",
        "aligntrue privacy revoke --all",
        "aligntrue privacy revoke --all --yes",
      ],
      notes: [
        "Subcommands:",
        "  audit              List all consents with timestamps",
        "  grant <operation>  Grant consent for operation (git)",
        "  revoke <operation> Revoke specific consent (git)",
        "  revoke --all       Revoke all consents",
        "  revoke --all --yes Revoke all consents without confirmation",
      ],
    });
    return;
  }

  switch (subcommand) {
    case "audit":
      await auditCommand();
      break;
    case "grant":
      await grantCommand(parsed.positional.slice(1));
      break;
    case "revoke":
      await revokeCommand(
        parsed.positional.slice(1),
        parsed.flags["all"] as boolean | undefined,
        parsed.flags["yes"] as boolean | undefined,
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
    if (isTTY()) {
      clack.log.info("No privacy consents granted yet");
    } else {
      console.log("No privacy consents granted yet");
    }
    console.log();
    console.log("Network operations will prompt for consent when needed.");
    console.log(
      'Run "aligntrue privacy audit" after granting consent to see details.',
    );
    return;
  }

  if (isTTY()) {
    clack.log.message("Privacy Consents");
  } else {
    console.log("Privacy Consents");
  }
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
 * Grant command - grant consent for operation
 */
async function grantCommand(operations: string[]): Promise<void> {
  const manager = createConsentManager();
  const operation = operations[0];

  if (!operation) {
    exitWithError({
      title: "Missing operation",
      message: "Specify operation to grant: git",
      hint: "Example: aligntrue privacy grant git",
      code: "ERR_MISSING_ARGUMENT",
    });
    return;
  }

  if (operation !== "git") {
    exitWithError({
      title: "Invalid operation",
      message: `Unknown operation: ${operation}`,
      hint: "Valid operation: git",
      code: "ERR_INVALID_ARGUMENT",
    });
    return;
  }

  // Check if already granted
  if (manager.checkConsent(operation)) {
    if (isTTY()) {
      clack.log.info(`Consent for '${operation}' already granted`);
    } else {
      console.log(`Consent for '${operation}' already granted`);
    }
    console.log();
    console.log('Run "aligntrue privacy audit" to see all consents.');
    return;
  }

  manager.grantConsent(operation);
  if (isTTY()) {
    clack.log.success(`Granted consent for '${operation}'`);
  } else {
    console.log(`✓ Granted consent for '${operation}'`);
  }
  console.log();
  console.log(
    `Network operations for ${operation} will now proceed without prompts.`,
  );
}

/**
 * Revoke command - revoke consent
 */
async function revokeCommand(
  operations: string[],
  all?: boolean,
  yes?: boolean,
): Promise<void> {
  const manager = createConsentManager();

  // Handle --all flag
  if (all) {
    const consents = manager.listConsents();

    if (consents.length === 0) {
      if (isTTY()) {
        clack.log.info("No consents to revoke");
      } else {
        console.log("No consents to revoke");
      }
      return;
    }

    // Skip confirmation if --yes flag provided
    if (yes) {
      // Proceed without confirmation
    } else if (isTTY()) {
      // Confirm before revoking all
      const confirmed = await clack.confirm({
        message: `Revoke all ${consents.length} consent(s)?`,
      });

      if (clack.isCancel(confirmed) || !confirmed) {
        clack.cancel("Revoke cancelled");
        return;
      }
    } else {
      // Non-interactive mode without --yes flag
      console.error(
        "Error: Cannot revoke all consents in non-interactive mode without --yes flag",
      );
      console.error(
        "Use --yes to skip confirmation, or run in an interactive terminal.",
      );
      process.exit(1);
    }

    manager.revokeAll();
    if (isTTY()) {
      clack.log.success(`Revoked all consents (${consents.length})`);
    } else {
      console.log(`✓ Revoked all consents (${consents.length})`);
    }
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
      message: "Specify operation to revoke: git",
      hint: 'Run "aligntrue privacy revoke --all" to revoke all consents',
      code: "ERR_MISSING_ARGUMENT",
    });
    return;
  }

  if (operation !== "git") {
    exitWithError({
      title: "Invalid operation",
      message: `Unknown operation: ${operation}`,
      hint: "Valid operation: git",
      code: "ERR_INVALID_ARGUMENT",
    });
    return;
  }

  // Check if consent exists
  if (!manager.checkConsent(operation)) {
    if (isTTY()) {
      clack.log.info(`No consent for '${operation}' to revoke`);
    } else {
      console.log(`No consent for '${operation}' to revoke`);
    }
    console.log();
    console.log('Run "aligntrue privacy audit" to see all consents.');
    return;
  }

  manager.revokeConsent(operation);
  if (isTTY()) {
    clack.log.success(`Revoked consent for '${operation}'`);
  } else {
    console.log(`✓ Revoked consent for '${operation}'`);
  }
  console.log();
  console.log(`Next sync will prompt for ${operation} consent again.`);
}
