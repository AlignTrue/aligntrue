import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import { hasKvEnv } from "./storeFactory";

type Fetcher = typeof fetch;

type CachedToken = {
  token: string;
  expiresAt: number; // epoch ms
};

const TOKEN_CACHE_KEY = "gh:token";
// GitHub installation tokens last 60 minutes; refresh 10 minutes early.
const TOKEN_SAFETY_WINDOW_MS = 10 * 60 * 1000;

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

let inMemoryToken: CachedToken | null = null;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodePrivateKey(value: string): string {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    // If it's already plain PEM, return as-is
    return value;
  }
}

function signJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // allow 1 minute clock drift
    exp: now + 9 * 60, // GitHub requires <=10 minutes
    iss: appId,
  };

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(data);
  const signature = sign.sign(privateKey);
  return `${data}.${base64Url(signature)}`;
}

async function requestInstallationToken(
  params: {
    appId: string;
    installationId: string;
    privateKey: string;
  },
  fetchImpl: Fetcher,
): Promise<CachedToken> {
  const jwt = signJwt(params.appId, params.privateKey);
  const res = await fetchImpl(
    `https://api.github.com/app/installations/${params.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "User-Agent": "aligntrue-web",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to create GitHub App installation token (${res.status} ${res.statusText}). ${body}`,
    );
  }

  const json = (await res.json()) as {
    token?: string;
    expires_at?: string;
  };

  if (!json.token || !json.expires_at) {
    throw new Error("GitHub App response missing token or expires_at.");
  }

  const expiresAtMs = new Date(json.expires_at).getTime();
  return { token: json.token, expiresAt: expiresAtMs };
}

function isTokenValid(token: CachedToken | null): boolean {
  if (!token) return false;
  const now = Date.now();
  return now + TOKEN_SAFETY_WINDOW_MS < token.expiresAt;
}

async function getCachedToken(): Promise<CachedToken | null> {
  if (isTokenValid(inMemoryToken)) return inMemoryToken;
  if (!hasKvEnv()) return null;

  const cached = await getRedis().get<CachedToken>(TOKEN_CACHE_KEY);
  if (!cached || !isTokenValid(cached)) return null;
  inMemoryToken = cached;
  return cached;
}

async function setCachedToken(token: CachedToken): Promise<void> {
  inMemoryToken = token;
  if (!hasKvEnv()) return;

  const ttlSeconds = Math.max(
    60,
    Math.floor((token.expiresAt - Date.now() - TOKEN_SAFETY_WINDOW_MS) / 1000),
  );
  await getRedis().set(TOKEN_CACHE_KEY, token, { ex: ttlSeconds });
}

export function hasGitHubAppConfig(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_INSTALLATION_ID &&
      process.env.GITHUB_APP_PRIVATE_KEY,
  );
}

function loadConfig(): {
  appId: string;
  installationId: string;
  privateKey: string;
} {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKeyEnv = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !installationId || !privateKeyEnv) {
    throw new Error(
      "Missing GitHub App configuration. Set GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, and GITHUB_APP_PRIVATE_KEY (base64 PEM).",
    );
  }

  const privateKey = decodePrivateKey(privateKeyEnv);
  return { appId, installationId, privateKey };
}

export async function getGitHubAppToken(options?: {
  fetchImpl?: Fetcher;
}): Promise<string | null> {
  if (!hasGitHubAppConfig()) {
    inMemoryToken = null;
    return null;
  }

  const fetcher = options?.fetchImpl ?? fetch;

  const cached = await getCachedToken();
  if (cached) return cached.token;

  const cfg = loadConfig();
  const fresh = await requestInstallationToken(cfg, fetcher);
  await setCachedToken(fresh);
  return fresh.token;
}

export async function getAuthToken(options?: {
  fetchImpl?: Fetcher;
}): Promise<string | null> {
  const appToken = await getGitHubAppToken(options);
  if (appToken) return appToken;

  const pat = process.env.GITHUB_TOKEN;
  if (pat) return pat;

  return null;
}
