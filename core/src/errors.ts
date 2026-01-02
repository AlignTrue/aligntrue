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

export class ValidationError extends OpsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", context);
  }
}

export class IdempotencyViolation extends OpsError {
  constructor(commandId: string) {
    super(`Command ${commandId} already processed`, "IDEMPOTENCY_VIOLATION", {
      commandId,
    });
  }
}

export class PreconditionFailed extends OpsError {
  constructor(expected: unknown, actual: unknown) {
    super("Precondition failed", "PRECONDITION_FAILED", { expected, actual });
  }
}
