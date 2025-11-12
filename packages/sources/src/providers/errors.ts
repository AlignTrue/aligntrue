/**
 * Error types for source providers
 */

export interface UpdateInfo {
  url: string;
  ref: string;
  currentSha: string;
  latestSha: string;
  commitsBehind: number;
}

/**
 * Error thrown when git source has updates available in team mode
 * Team mode requires explicit approval before pulling updates
 */
export class UpdatesAvailableError extends Error {
  public readonly url: string;
  public readonly ref: string;
  public readonly currentSha: string;
  public readonly latestSha: string;
  public readonly commitsBehind: number;

  constructor(info: UpdateInfo) {
    super(`Updates available for ${info.url} (${info.ref})`);
    this.name = "UpdatesAvailableError";
    this.url = info.url;
    this.ref = info.ref;
    this.currentSha = info.currentSha;
    this.latestSha = info.latestSha;
    this.commitsBehind = info.commitsBehind;

    // Maintain proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UpdatesAvailableError);
    }
  }
}
