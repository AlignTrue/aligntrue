# @aligntrue/sources

Multi-source rule pulling with caching for AlignTrue.

## Features

- **Local provider** - Read rules from local filesystem
- **Catalog provider** - Fetch from AlignTrue catalog (GitHub raw URLs)
- **Git provider** - Clone and read from git repos with local caching
- **URL provider** - Fetch from arbitrary URLs (Phase 2+)
- **Cache management** - Local cache in .aligntrue/.cache/

## Providers

### Local Provider

Read rules from the local filesystem with path traversal protection.

```typescript
import { createProvider } from '@aligntrue/sources';

const provider = createProvider({
  type: 'local',
  path: '.aligntrue/rules.md'
});

const content = await provider.fetch('rules.md');
```

**Security:**
- Rejects paths with `..` (parent directory traversal)
- Normalizes paths to absolute for consistent resolution

### Catalog Provider

Fetch packs from the AlignTrue/aligns GitHub repository with local caching and offline fallback.

```typescript
import { createProvider } from '@aligntrue/sources';

const provider = createProvider({
  type: 'catalog',
  id: 'packs/base/base-global',
  forceRefresh: false, // Optional: bypass cache
  warnOnStaleCache: true // Optional: warn when using offline cache
});

const yaml = await provider.fetch('packs/base/base-global');
```

**Configuration:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | `'catalog'` | Yes | - | Provider type identifier |
| `id` | `string` | Yes | - | Pack ID (e.g., `packs/base/base-global`) |
| `forceRefresh` | `boolean` | No | `false` | Bypass cache and fetch fresh |
| `warnOnStaleCache` | `boolean` | No | `true` | Warn when using offline cache |

**Features:**
- **Two-step validation:** Fetches `catalog/index.json` first to validate pack exists
- **Local caching:** Cache in `.aligntrue/.cache/catalog/` with indefinite TTL
- **Offline fallback:** Uses cache when network unavailable with warning
- **Force refresh:** `--force-refresh` bypasses cache (future CLI)
- **Security:** Pack ID validation prevents path traversal attacks

**Pack ID Format:**
Pack IDs must match: `packs/<category>/<pack-name>`

Examples:
- `packs/base/base-global`
- `packs/base/base-testing`
- `packs/stacks/nextjs-app-router`

**Cache Behavior:**

1. **First fetch:** Downloads from GitHub, caches locally
2. **Subsequent fetches:** Returns from cache (no network call)
3. **Force refresh:** Bypasses cache, downloads fresh, updates cache
4. **Network unavailable:** Falls back to cache with warning
5. **No cache + network error:** Fails with clear error message

**Cache Location:**
```
.aligntrue/.cache/catalog/
  index.json                     # Catalog index
  packs/base/base-global.yaml    # Cached pack
  packs/base/base-testing.yaml   # Cached pack
```

**GitHub URLs:**
- Index: `https://raw.githubusercontent.com/AlignTrue/aligns/main/catalog/index.json`
- Pack: `https://raw.githubusercontent.com/AlignTrue/aligns/main/packs/base/base-global.yaml`

**Error Handling:**

| Error | Behavior |
|-------|----------|
| Pack not in catalog | Fails with list of available packs |
| HTTP 404 | Clear error: pack may have been removed |
| Network timeout | Falls back to cache if available |
| Corrupted cache | Refetches from GitHub |
| Invalid pack ID | Rejects with format explanation |

**Example Config:**

```yaml
# .aligntrue/config.yaml
sources:
  - type: catalog
    id: packs/base/base-global
  - type: catalog
    id: packs/base/base-testing
  - type: local
    path: .aligntrue/custom-rules.md
```

### Git Provider

Clone rules from any git repository (GitHub, GitLab, self-hosted) with local caching and offline fallback.

```typescript
import { createProvider } from '@aligntrue/sources';

const provider = createProvider({
  type: 'git',
  url: 'https://github.com/org/rules-repo',
  ref: 'main', // Optional: branch/tag/commit (default: 'main')
  path: '.aligntrue.yaml', // Optional: path to rules file (default: '.aligntrue.yaml')
  forceRefresh: false // Optional: bypass cache
});

const yaml = await provider.fetch();
```

**Features:**
- Shallow clone (`--depth 1`) for speed and space efficiency
- Local cache: `.aligntrue/.cache/git/<repo-hash>/`
- Indefinite cache TTL (manual refresh only)
- Offline fallback to cached version
- Supports https and ssh URLs
- Atomic cache updates (preserves old cache on network failure)

**Cache behavior:**
- First fetch: Clones repo to cache
- Subsequent fetches: Returns from cache (no network call)
- Force refresh: Clones to temp location, replaces cache on success
- Network error + cache: Falls back to cache with warning
- Network error + no cache: Fails with clear error

**Security:**
- Rejects `file://` protocol
- Rejects URLs with path traversal (`..`)
- Validates https/ssh URL formats
- Privacy TODOs for Phase 2 Step 10 (consent system)

**Example Config:**

```yaml
# .aligntrue/config.yaml
sources:
  # HTTPS with branch
  - type: git
    url: https://github.com/AlignTrue/shared-rules
    ref: main

  # SSH with tag
  - type: git
    url: git@github.com:myorg/private-rules.git
    ref: v1.0.0

  # Specific commit SHA
  - type: git
    url: https://gitlab.com/team/rules
    ref: abc123def456
    path: config/aligntrue.yaml

  # Force refresh (bypass cache)
  - type: git
    url: https://github.com/AlignTrue/shared-rules
    ref: main
    forceRefresh: true
```

**Error Handling:**

| Error | Behavior |
|-------|----------|
| Authentication failed | Fails with SSH key hint |
| Repository not found (404) | Fails with URL validation hint |
| Invalid branch/tag/commit | Fails with ref name hint |
| Network timeout | Falls back to cache if available |
| Corrupted cache | Reports error (use forceRefresh to fix) |
| Rules file missing | Fails with helpful path suggestion |

## Troubleshooting

### Network Errors

If you see `Network unavailable, using cached pack`:
- This is expected when offline
- Cache will be refreshed on next online sync
- Use `--force-refresh` to bypass cache when online (future CLI)

### Pack Not Found

If you see `Pack not found in catalog`:
- Check pack ID spelling
- Verify pack exists in AlignTrue/aligns repository
- See available packs in error message

### Cache Issues

If cache seems stale or corrupted:
- Delete `.aligntrue/.cache/catalog/` directory
- Run sync again to rebuild cache

## Package Status

✅ **Phase 1, Stage 3, Step 27** - Catalog provider complete with 33 tests passing

