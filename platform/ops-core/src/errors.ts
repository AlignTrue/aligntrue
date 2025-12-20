/**
 * Base error class for ops-core.
 * All errors are typed and serializable.
 */
export class OpsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OpsError";
  }
}
