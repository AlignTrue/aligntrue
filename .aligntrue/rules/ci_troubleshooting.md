---
description: Guidance for troubleshooting CI/CD failures and checking GitHub Actions status
globs:
  - .github/workflows/*.yml
  - scripts/check-ci-errors.mjs
  - scripts/check-codeql-status.mjs
content_hash: 2a57260e7f9653ae3fc792b8f023867a1a084bf5f21c2c8830931eca8e89b02a
---

# CI troubleshooting and status checking

**When to apply:** The user asks about CI status, why a build failed, or requests to check GitHub Actions/Workflows.

## Core principle

**Conserve API Rate Limits.** AI agents and scripts can easily hit GitHub API rate limits (60/hr unauthenticated, 5000/hr authenticated). Always prefer local verification and efficient API usage.

## Troubleshooting workflow

Follow this priority order when investigating CI issues:

### 1. Local reproduction (zero API cost)

Always attempt to reproduce failures locally first. This is faster and uses no API quota.

```bash
# Run the full validation suite (matches CI)
pnpm validate:all

# Or specific checks
pnpm test               # Unit tests
pnpm build:packages     # Build
pnpm lint               # Linting
```

### 2. CI error details (low API cost)

If local checks pass but CI fails, fetch actual error details directly:

```bash
# Fetches the most recent failed CI run and displays error details
pnpm ci:errors
```

This shows test failures, assertion errors, and other actionable details in one command.

### 3. Code scanning and security alerts (low API cost)

If you need to check GitHub code scanning (CodeQL) alerts:

```bash
# Check code scanning alerts and security issues
pnpm codeql:status
```

This efficiently fetches and displays alerts by severity, with direct links to review them.

### 4. Web UI (fallback)

If rate limits are hit or complex debugging is needed, direct the user to the browser:

- **Actions Tab:** https://github.com/AlignTrue/aligntrue/actions
- **Current Branch:** https://github.com/AlignTrue/aligntrue/actions?query=branch%3A<branch-name>
- **Code Scanning:** https://github.com/AlignTrue/aligntrue/security/code-scanning

## Anti-patterns to avoid

- ❌ **DO NOT** run `gh run list` repeatedly in a loop.
- ❌ **DO NOT** use `gh api` for simple status checks without checking rate limits.
- ❌ **DO NOT** assume CI failure implies code error; check for flakes or infrastructure issues.
- ❌ **DO NOT** blindly retry CI jobs without understanding the failure.

## Rate limit awareness

If you encounter `API rate limit exceeded` or HTTP 403/429 errors:

1.  Stop making API calls immediately.
2.  Direct the user to the Web UI.
3.  Explain that the rate limit was hit.

## Integration

- **CI Workflow File:** `.github/workflows/ci.yml` (Defines what actually runs)
- **CI Errors Script:** `scripts/check-ci-errors.mjs` (Fetches and displays failed CI error details)
- **CodeQL Status Script:** `scripts/check-codeql-status.mjs` (Checks code scanning alerts)
- **CodeQL Workflow File:** `.github/workflows/codeql.yml` (Defines code scanning configuration)
