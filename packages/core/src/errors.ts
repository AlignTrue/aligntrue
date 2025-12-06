/**
 * Standardized error types for AlignTrue
 * Moved from CLI to Core for reuse across packages
 */

/**
 * Base error class for all AlignTrue errors
 */
export class AlignTrueError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1,
    public hint?: string,
    public nextSteps?: string[],
  ) {
    super(message);
    this.name = "AlignTrueError";
    Error.captureStackTrace(this, this.constructor);
  }

  withNextSteps(steps: string[]): this {
    this.nextSteps = steps;
    return this;
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends AlignTrueError {
  constructor(message: string, hint?: string) {
    super(message, "CONFIG_ERROR", 2, hint);
    this.name = "ConfigError";
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AlignTrueError {
  constructor(message: string, hint?: string) {
    super(message, "VALIDATION_ERROR", 1, hint);
    this.name = "ValidationError";
  }
}

/**
 * Sync operation errors
 */
export class SyncError extends AlignTrueError {
  constructor(message: string, hint?: string) {
    super(message, "SYNC_ERROR", 1, hint);
    this.name = "SyncError";
  }
}

/**
 * Team mode specific errors
 */
export class TeamModeError extends AlignTrueError {
  constructor(message: string, hint?: string) {
    super(message, "TEAM_MODE_ERROR", 1, hint);
    this.name = "TeamModeError";
  }
}

/**
 * Feature not implemented error
 */
export class NotImplementedError extends AlignTrueError {
  constructor(feature: string, hint?: string) {
    super(
      `Feature not yet implemented: ${feature}`,
      "NOT_IMPLEMENTED",
      1,
      hint || "This feature is intentionally unavailable in this build",
    );
    this.name = "NotImplementedError";
  }
}

/**
 * File system errors
 */
export class FileSystemError extends AlignTrueError {
  constructor(operation: string, path: string, cause?: string, hint?: string) {
    super(
      `Failed to ${operation}: ${path}${cause ? ` - ${cause}` : ""}`,
      "FILE_SYSTEM_ERROR",
      2,
      hint,
    );
    this.name = "FileSystemError";
  }
}

/**
 * Network/remote errors
 */
export class NetworkError extends AlignTrueError {
  constructor(message: string, hint?: string) {
    super(message, "NETWORK_ERROR", 1, hint);
    this.name = "NetworkError";
  }
}

/**
 * Error factory functions for common cases
 */
export const ErrorFactory = {
  configNotFound: (path: string): ConfigError =>
    new ConfigError(
      `Configuration file not found: ${path}`,
      "Run 'aligntrue init' to create a configuration file",
    ).withNextSteps([
      "Run: aligntrue init",
      `Or specify the config path explicitly: aligntrue sync --config ${path}`,
    ]),

  invalidConfig: (reason: string): ConfigError =>
    new ConfigError(`Invalid configuration: ${reason}`).withNextSteps([
      "Run: aligntrue config show",
      "Edit: aligntrue config edit",
    ]),

  syncFailed: (reason: string): SyncError =>
    new SyncError(`Sync operation failed: ${reason}`),

  validationFailed: (reason: string): ValidationError =>
    new ValidationError(`Validation failed: ${reason}`).withNextSteps([
      "Run: aligntrue check --ci",
      "Fix the reported errors and re-run the command",
    ]),

  teamModeRequired: (feature: string): TeamModeError =>
    new TeamModeError(
      `${feature} requires team mode`,
      "Set mode: team in .aligntrue/config.yaml",
    ),

  fileNotFound: (path: string): FileSystemError =>
    new FileSystemError("read file", path, "file not found"),

  fileWriteFailed: (path: string, cause?: string): FileSystemError => {
    // Check if this is a permission error
    const isPermissionErr =
      cause &&
      (cause.toLowerCase().includes("permission denied") ||
        cause.toLowerCase().includes("eacces") ||
        cause.toLowerCase().includes("eperm") ||
        cause.includes("EACCES") ||
        cause.includes("EPERM"));

    if (isPermissionErr) {
      return new FileSystemError(
        "write file",
        path,
        cause,
        "Permission denied: Cannot write to file",
      ).withNextSteps([
        "Check file permissions (chmod) or remove read-only flags",
        "Ensure the directory is writable",
        "Run with appropriate permissions or use sudo if needed",
        `Verify the path exists: ${path}`,
      ]);
    }

    return new FileSystemError("write file", path, cause).withNextSteps([
      "Check file permissions or remove read-only flags",
      `Verify the path exists: ${path}`,
    ]);
  },

  notImplemented: (feature: string, hint?: string): NotImplementedError =>
    new NotImplementedError(feature, hint),
};
