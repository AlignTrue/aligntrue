/**
 * Error class for ops CLI with structured metadata
 */
export class OpsCliError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number,
    public readonly hint?: string,
    public readonly nextSteps?: string[],
  ) {
    super(message);
    this.name = "OpsCliError";
  }
}

/**
 * Minimal exit helper for ops CLI commands.
 * Matches the behavior used in the sync CLI: exit code 2 for usage errors,
 * 1 for command/runtime errors.
 */
export function exitWithError(
  exitCode: number,
  message?: string,
  options: { hint?: string; nextSteps?: string[] } = {},
): never {
  const resolvedMessage =
    message || (exitCode === 2 ? "Invalid command usage" : "Command failed");

  const error = new OpsCliError(
    resolvedMessage,
    exitCode === 2 ? "CLI_USAGE_ERROR" : "CLI_COMMAND_ERROR",
    exitCode,
    options.hint,
    options.nextSteps,
  );

  throw error;
}
