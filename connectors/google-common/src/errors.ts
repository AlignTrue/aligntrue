import { OpsError } from "@aligntrue/core";

/**
 * Google API error wrapper that never includes sensitive token data.
 */
export class GoogleApiError extends OpsError {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    body?: string,
  ) {
    super(`Google API error ${status} at ${endpoint}`, "GOOGLE_API_ERROR", {
      status,
      endpoint,
      // Truncate body defensively to avoid leaking sensitive data.
      ...(body ? { body: body.slice(0, 200) } : {}),
    });
  }
}

/**
 * Specialized error for expired or invalid access tokens.
 */
export class TokenExpiredError extends GoogleApiError {
  constructor(endpoint: string) {
    super(401, endpoint, "Token expired or invalid");
  }
}
