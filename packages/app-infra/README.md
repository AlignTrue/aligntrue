# @aligntrue/app-infra

Shared app-layer infrastructure for demos and UI surfaces. Provides GitHub helpers, OG image generation, and rate limiting with Redis/Upstash + Blob storage integrations.

## Purpose

- Reusable app infrastructure for demos without coupling to product logic.
- Deterministic helpers for GitHub auth/fetch, caching, and rate limits.
- OG image pipeline (next/og + sharp) with hash-addressed blob storage.

## Architecture

```
@aligntrue/app-infra
  ├─ github/   (auth, caching fetch, rate limit helpers)
  ├─ og/       (render + store OG assets)
  └─ rate-limit/ (shared limiter)
```

- Consumers: demo apps (e.g., vercel/ai), future app-layer use.
- Dependencies: `@upstash/redis`, `@vercel/blob`, `sharp`; peer `next >=14`, `react >=18`.
- No business logic; surface generic helpers only.

## Features

### GitHub helpers (`src/github/`)

- Auth hierarchy: GitHub App token → PAT → unauthenticated/null.
- Caching fetcher: ETag-aware, Redis/Upstash when available, in-memory fallback.
- Token cache: in-memory + Redis with safety window.

### OG image generation (`src/og/`)

- Rendering: `next/og` + Inter font CDN + hash-based color bar.
- Encoding: `sharp` to JPEG with deterministic settings.
- Storage: Vercel Blob with hash-addressed keys; metadata persisted in Redis.
- Regeneration: content hash check; `force` flag to override.

### Rate limiting (`src/rate-limit/`)

- Sliding window (default 10 req / 60s), Redis-backed when available.
- In-memory fallback for local dev or missing KV env.
- Simple `allow(id)` API.

## Environment variables

| Component     | Required                                                                                           | Optional                                 | Notes                                                |
| ------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| GitHub App    | `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` (base64 PEM or raw PEM)    | `GITHUB_TOKEN` (PAT fallback)            | App token preferred; PAT only if App is unavailable. |
| Fetch caching | KV env (Upstash or Vercel KV)                                                                      | `GITHUB_DISABLE_CACHING=true` to disable | In-memory cache always on.                           |
| OG storage    | `BLOB_READ_WRITE_TOKEN`, KV env (Upstash/Vercel KV)                                                | —                                        | Skips OG generation when Blob or KV is absent.       |
| Rate limit    | KV env (Upstash/Vercel KV)                                                                         | `NODE_ENV=test` disables limiter         | Falls back to in-memory when KV is missing.          |
| KV (either)   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` **or** `KV_REST_API_URL`, `KV_REST_API_TOKEN` | —                                        | Used by caching, OG metadata, rate limit.            |

## Usage examples

### GitHub auth token

```typescript
import { getAuthToken } from "@aligntrue/app-infra/github";

const token = await getAuthToken();
if (!token) {
  throw new Error("GitHub auth not configured");
}
```

### Caching fetch with ETag

```typescript
import { createCachingFetch } from "@aligntrue/app-infra/github";
import { getRedis } from "@aligntrue/app-infra/kv";

const redis = getRedis(); // requires KV env
const fetchGitHub = createCachingFetch(redis, { userAgent: "my-demo" });

const res = await fetchGitHub(
  "https://api.github.com/repos/AlignTrue/aligntrue",
);
const json = await res.json();
```

### Ensure OG image exists

```typescript
import { ensureOgImage } from "@aligntrue/app-infra/og";

const meta = await ensureOgImage({
  id: "demo-123",
  dataHash: "sha256:content-hash",
  content: {
    title: "AlignTrue preview",
    description: "Deterministic AI receipts preview",
    badge: "Preview",
    command: "npx aligntrue demo",
  },
});

if (meta) {
  console.log("OG URL", meta.url);
}
```

### Rate limiter

```typescript
import { createRateLimiter } from "@aligntrue/app-infra/rate-limit";

const allow = createRateLimiter({ windowSeconds: 60, maxRequests: 10 });

if (!(await allow("client-ip-or-token"))) {
  throw new Error("Rate limit exceeded");
}
```

## API reference (summary)

- `github/app-tokens.ts`
  - `hasGitHubAppConfig(): boolean`
  - `getGitHubAppToken(options?): Promise<string | null>`
  - `getAuthToken(options?): Promise<string | null>`
- `github/caching-fetch.ts`
  - `createCachingFetch(redis, options?): Fetcher`
- `kv/factory.ts`
  - `hasKvEnv(): boolean`
  - `getRedis(): Redis`
- `og/generate.tsx`
  - `buildOgImageResponse(options): Promise<Response>`
  - `renderOgPng(options): Promise<Buffer>`
  - `generateOgImage(options): Promise<Buffer>`
- `og/service.ts`
  - `ensureOgImage(options): Promise<OgMetadata | null>`
- `rate-limit/limiter.ts`
  - `createRateLimiter(options?): (id: string) => Promise<boolean>`
  - `rateLimit` (default instance)

## License

MIT
