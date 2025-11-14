/**
 * Standardized error types for AlignTrue CLI
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
  ) {
    super(message);
    this.name = "AlignTrueError";
    Error.captureStackTrace(this, this.constructor);
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
      hint || "This feature is planned for a future release",
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
    ),

  invalidConfig: (reason: string): ConfigError =>
    new ConfigError(`Invalid configuration: ${reason}`),

  syncFailed: (reason: string): SyncError =>
    new SyncError(`Sync operation failed: ${reason}`),

  validationFailed: (reason: string): ValidationError =>
    new ValidationError(`Validation failed: ${reason}`),

  teamModeRequired: (feature: string): TeamModeError =>
    new TeamModeError(
      `${feature} requires team mode`,
      "Set mode: team in .aligntrue/config.yaml",
    ),

  fileNotFound: (path: string): FileSystemError =>
    new FileSystemError("read file", path, "file not found"),

  fileWriteFailed: (path: string, cause?: string): FileSystemError =>
    new FileSystemError("write file", path, cause),

  notImplemented: (feature: string, hint?: string): NotImplementedError =>
    new NotImplementedError(feature, hint),
};
