# @aligntrue/sources

Multi-source rule pulling with caching for AlignTrue.

## Features

- **Local provider** - Read rules from local filesystem
- **Git provider** - Clone and read from git repos with local caching
- **Cache management** - Local cache in .aligntrue/.cache/

## Providers

### Local Provider

Read rules from the local filesystem with path traversal protection.

```typescript
import { createProvider } from "@aligntrue/sources";

const provider = createProvider({
  type: "local",
  path: ".aligntrue/rules",
});

const content = await provider.fetch("rules");
```

**Security:**

- Rejects paths with `..` (parent directory traversal)
- Normalizes paths to absolute for consistent resolution

### Git Provider

Clone rules from any git repository (GitHub, GitLab, self-hosted) with local caching and offline fallback.

```typescript
import { createProvider } from "@aligntrue/sources";

const provider = createProvider({
  type: "git",
  url: "https://github.com/org/rules-repo",
  ref: "main", // Optional: branch/tag/commit (default: 'main')
  path: ".", // Optional: path to scan for rules (default: '.' scans root for .md/.mdc files)
  forceRefresh: false, // Optional: bypass cache
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
- Privacy TODOs for consent system (implemented)

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

| Error                      | Behavior                                |
| -------------------------- | --------------------------------------- |
| Authentication failed      | Fails with SSH key hint                 |
| Repository not found (404) | Fails with URL validation hint          |
| Invalid branch/tag/commit  | Fails with ref name hint                |
| Network timeout            | Falls back to cache if available        |
| Corrupted cache            | Reports error (use forceRefresh to fix) |
| Rules file missing         | Fails with helpful path suggestion      |

## Troubleshooting

### Network Errors

If you see `Network unavailable, using cached align`:

- This is expected when offline
- Cache will be refreshed on next online sync
- Use `--force-refresh` to bypass cache when online (future CLI)

### Cache Issues

If cache seems stale or corrupted:

- Delete `.aligntrue/.cache/git/` directory
- Run sync again to rebuild cache
