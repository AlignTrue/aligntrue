import { GoogleApiError, TokenExpiredError } from "./errors.js";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt?: number | undefined;
}

export interface LoadTokenOptions {
  allowRefresh?: boolean;
}

/**
 * Returns true if token is missing or will expire within the buffer.
 */
export function isTokenExpiringSoon(
  expiresAt?: number,
  bufferMs = 60_000,
): boolean {
  if (!expiresAt) return false;
  return Date.now() + bufferMs >= expiresAt;
}

/**
 * Refresh access token using OAuth2 refresh flow (Google).
 */
export async function refreshAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    refresh_token: opts.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new GoogleApiError(res.status, "oauth2.googleapis.com/token", text);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };

  const expiresAt = json.expires_in
    ? Date.now() + json.expires_in * 1000
    : undefined;

  return {
    accessToken: json.access_token,
    ...(json.refresh_token !== undefined && {
      refreshToken: json.refresh_token,
    }),
    ...(json.refresh_token === undefined && {
      refreshToken: opts.refreshToken,
    }),
    ...(expiresAt !== undefined && { expiresAt }),
  };
}

/**
 * Helper to read token set from environment for local dogfooding.
 */
export function getTokenFromEnv(): TokenSet {
  const accessToken = process.env["GOOGLE_ACCESS_TOKEN"];
  const refreshToken = process.env["GOOGLE_REFRESH_TOKEN"];
  const expiresRaw = process.env["GOOGLE_TOKEN_EXPIRES_AT"];

  if (!accessToken) {
    throw new Error("GOOGLE_ACCESS_TOKEN is required");
  }

  const expiresAt = expiresRaw ? Number.parseInt(expiresRaw, 10) : undefined;
  return { accessToken, refreshToken, expiresAt };
}

/**
 * Load token set from env, proactively refreshing if expiring soon.
 * Mutates the provided token set in-place when refreshed.
 */
export async function loadTokenSet(
  opts: LoadTokenOptions = {},
): Promise<TokenSet> {
  const tokens = getTokenFromEnv();
  if (
    opts.allowRefresh !== false &&
    tokens.refreshToken &&
    isTokenExpiringSoon(tokens.expiresAt)
  ) {
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
    if (clientId && clientSecret) {
      const refreshed = await refreshAccessToken({
        refreshToken: tokens.refreshToken,
        clientId,
        clientSecret,
      });
      tokens.accessToken = refreshed.accessToken;
      tokens.refreshToken = refreshed.refreshToken;
      tokens.expiresAt = refreshed.expiresAt;
      // Persist for this process when available; harmless in serverless.
      process.env["GOOGLE_ACCESS_TOKEN"] = refreshed.accessToken;
      if (refreshed.expiresAt !== undefined) {
        process.env["GOOGLE_TOKEN_EXPIRES_AT"] = String(refreshed.expiresAt);
      }
    }
  }
  return tokens;
}

/**
 * Run an operation with automatic refresh + retry on 401.
 * Mutates the provided token set when refreshed to keep callers in sync.
 */
export async function withTokenRefresh<T>(
  fn: (accessToken: string) => Promise<T>,
  tokens: TokenSet,
): Promise<T> {
  try {
    return await fn(tokens.accessToken);
  } catch (err) {
    if (err instanceof TokenExpiredError && tokens.refreshToken) {
      const clientId = process.env["GOOGLE_CLIENT_ID"];
      const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
      if (clientId && clientSecret) {
        const refreshed = await refreshAccessToken({
          refreshToken: tokens.refreshToken,
          clientId,
          clientSecret,
        });
        tokens.accessToken = refreshed.accessToken;
        tokens.refreshToken = refreshed.refreshToken;
        tokens.expiresAt = refreshed.expiresAt;
        process.env["GOOGLE_ACCESS_TOKEN"] = refreshed.accessToken;
        if (refreshed.expiresAt !== undefined) {
          process.env["GOOGLE_TOKEN_EXPIRES_AT"] = String(refreshed.expiresAt);
        }
        return await fn(refreshed.accessToken);
      }
    }
    throw err;
  }
}
