import crypto from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = process.env;
const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const privateKeyPem = privateKey
  .export({ format: "pem", type: "pkcs1" })
  .toString();
const base64PrivateKey = Buffer.from(privateKeyPem).toString("base64");

const redisStore = new Map<string, unknown>();

function mockEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = {
    ...originalEnv,
    GITHUB_APP_ID: "123",
    GITHUB_APP_INSTALLATION_ID: "999",
    GITHUB_APP_PRIVATE_KEY: base64PrivateKey,
    ...overrides,
  };
}

function okResponse(token: string, ttlMs: number): Response {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  return new Response(
    JSON.stringify({
      token,
      expires_at: expiresAt,
    }),
    { status: 200 },
  );
}

async function importModule(hasKv: boolean) {
  vi.resetModules();

  // Mock Redis with an in-memory map
  vi.doMock("@upstash/redis", () => {
    class Redis {
      static fromEnv() {
        return new Redis();
      }
      async get<T>(key: string): Promise<T | null> {
        return (redisStore.get(key) as T) ?? null;
      }
      async set(key: string, value: unknown): Promise<string> {
        redisStore.set(key, value);
        return "OK";
      }
    }
    return { Redis };
  });

  vi.doMock("./storeFactory", () => ({
    hasKvEnv: () => hasKv,
  }));

  return await import("./github-app");
}

describe("getGitHubAppToken", () => {
  beforeEach(() => {
    mockEnv();
    redisStore.clear();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("returns a token and caches in memory", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse("token-1", 60 * 60 * 1000));

    const { getGitHubAppToken } = await importModule(false);

    const token1 = await getGitHubAppToken({ fetchImpl: fetchMock });
    const token2 = await getGitHubAppToken({ fetchImpl: fetchMock });

    expect(token1).toBe("token-1");
    expect(token2).toBe("token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes when token is expired", async () => {
    const fetchMock = vi
      .fn()
      // Expired almost immediately (safety window forces refresh)
      .mockResolvedValueOnce(okResponse("token-old", 500))
      .mockResolvedValueOnce(okResponse("token-new", 60 * 60 * 1000));

    const { getGitHubAppToken } = await importModule(false);

    const token1 = await getGitHubAppToken({ fetchImpl: fetchMock });
    const token2 = await getGitHubAppToken({ fetchImpl: fetchMock });

    expect(token1).toBe("token-old");
    expect(token2).toBe("token-new");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads from Redis cache across module reloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse("token-redis", 60 * 60 * 1000));

    const { getGitHubAppToken } = await importModule(true);
    const first = await getGitHubAppToken({ fetchImpl: fetchMock });
    expect(first).toBe("token-redis");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Reload module to clear in-memory cache but preserve Redis mock store
    const { getGitHubAppToken: reloaded } = await importModule(true);
    const second = await reloaded({ fetchImpl: fetchMock });

    expect(second).toBe("token-redis");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when configuration is missing", async () => {
    mockEnv({
      GITHUB_APP_ID: undefined,
    });
    const { getGitHubAppToken } = await importModule(false);

    await expect(getGitHubAppToken({ fetchImpl: vi.fn() })).rejects.toThrow(
      "Missing GitHub App configuration",
    );
  });

  it("throws on GitHub API errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("bad", { status: 401, statusText: "Unauthorized" }),
      );

    const { getGitHubAppToken } = await importModule(false);

    await expect(getGitHubAppToken({ fetchImpl: fetchMock })).rejects.toThrow(
      /Failed to create GitHub App installation token/,
    );
  });
});
