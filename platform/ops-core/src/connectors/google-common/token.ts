import { GoogleApiError } from "./errors.js";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt?: number | undefined;
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
