/**
 * Common CLI error patterns
 *
 * Provides factory functions for frequently-encountered errors across commands.
 * Ensures consistent wording and actionable hints.
 */

import type { CLIError } from "./error-formatter.js";

/**
 * Common error patterns used across CLI commands
 */
export const CommonErrors = {
  /**
   * Config file not found error
   *
   * @param path - Config file path that was not found
   * @returns Formatted error with hint to run init
   */
  configNotFound: (path: string): CLIError => ({
    title: "Config file not found",
    message: `Could not locate: ${path}`,
    hint: "Run 'aligntrue init' to create initial configuration",
    code: "ERR_CONFIG_NOT_FOUND",
  }),

  /**
   * Config validation failed error
   *
   * @param path - Config file path
   * @param details - Validation error details
   * @returns Formatted error with validation details
   */
  configValidationFailed: (path: string, details: string[]): CLIError => ({
    title: "Config validation failed",
    message: `Configuration file ${path} contains errors`,
    details,
    hint: "Fix the errors above and try again",
    code: "ERR_CONFIG_VALIDATION_FAILED",
  }),

  /**
   * Rules file not found error
   *
   * @param path - Rules file path that was not found
   * @returns Formatted error with hint to create rules
   */
  rulesNotFound: (path: string): CLIError => ({
    title: "Rules file not found",
    message: `Could not locate: ${path}`,
    hint: "Run 'aligntrue init' to create initial rules or update sources in config",
    code: "ERR_RULES_NOT_FOUND",
  }),

  /**
   * Rules validation failed error
   *
   * @param details - Validation error details
   * @returns Formatted error with validation details
   */
  validationFailed: (details: string[]): CLIError => ({
    title: "Validation failed",
    message: "The configuration or rules contain errors",
    details,
    hint: "Fix the errors above and try again",
    code: "ERR_VALIDATION_FAILED",
  }),

  /**
   * Sync operation failed error
   *
   * @param reason - Reason for sync failure
   * @returns Formatted error with help hint
   */
  syncFailed: (reason: string): CLIError => ({
    title: "Sync failed",
    message: reason,
    hint: "Run 'aligntrue sync --help' for more options",
    code: "ERR_SYNC_FAILED",
  }),

  /**
   * Adapter not found error
   *
   * @param adapterName - Name of adapter that was not found
   * @returns Formatted error with list hint
   */
  adapterNotFound: (adapterName: string): CLIError => ({
    title: "Adapter not found",
    message: `Adapter '${adapterName}' is not available`,
    hint: "Run 'aligntrue adapters list' to see available adapters",
    code: "ERR_ADAPTER_NOT_FOUND",
  }),

  /**
   * File write failed error
   *
   * @param path - File path that failed to write
   * @param reason - Reason for failure
   * @returns Formatted error with permissions hint
   */
  fileWriteFailed: (path: string, reason: string): CLIError => ({
    title: "File write failed",
    message: `Could not write to: ${path}`,
    details: [reason],
    hint: "Check file permissions and disk space",
    code: "ERR_FILE_WRITE_FAILED",
  }),

  /**
   * Import failed error
   *
   * @param agent - Agent format that failed to import
   * @param reason - Reason for import failure
   * @returns Formatted error with format hint
   */
  importFailed: (agent: string, reason: string): CLIError => ({
    title: "Import failed",
    message: `Could not import from ${agent} format`,
    details: [reason],
    hint: `Check that the ${agent} file format is valid`,
    code: "ERR_IMPORT_FAILED",
  }),

  /**
   * Generic operation failed error
   *
   * @param operation - Name of operation that failed
   * @param reason - Reason for failure
   * @returns Formatted error
   */
  operationFailed: (operation: string, reason: string): CLIError => ({
    title: `${operation} failed`,
    message: reason,
    code: "ERR_OPERATION_FAILED",
  }),

  /**
   * Missing required argument error
   *
   * @param argName - Name of missing argument
   * @param usage - Usage example
   * @returns Formatted error with usage hint
   */
  missingArgument: (argName: string, usage: string): CLIError => ({
    title: "Missing required argument",
    message: `Argument '${argName}' is required`,
    hint: `Usage: ${usage}`,
    code: "ERR_MISSING_ARGUMENT",
  }),

  /**
   * Lockfile validation failed error
   *
   * @param details - Validation error details
   * @returns Formatted error with sync hint
   */
  lockfileValidationFailed: (details: string[]): CLIError => ({
    title: "Lockfile validation failed",
    message: "Lockfile contains errors or drift detected",
    details,
    hint: "Run 'aligntrue sync' to regenerate lockfile",
    code: "ERR_LOCKFILE_VALIDATION_FAILED",
  }),
};
