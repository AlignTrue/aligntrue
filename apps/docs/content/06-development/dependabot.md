---
title: Dependabot auto-merge
description: Hybrid approach to automatically merging Dependabot PRs while preserving manual review for higher-risk changes
---

# Dependabot auto-merge strategy

This document explains AlignTrue's hybrid approach to automatically merging Dependabot PRs.

## Overview

**Goal:** Save maintainer time on routine dependency updates while preserving manual review for higher-risk changes.

**Strategy:**

- ✅ Auto-merge: devDependencies, patch & minor updates
- 🚫 Manual review: production dependencies, major version bumps

## Configuration

### 1. `.github/dependabot.yml`

Dependabot is configured to:

- Create separate PRs per directory (workspace isolation)
- Label PRs by scope (devDependencies, schema, cli, web, docs, etc.)
- Group updates intelligently (production vs development)
- Ignore unsafe updates (e.g., Next.js major versions)

**Key scopes:**

- **Root `/`**: dev-dependencies only → auto-merge safe
- **Packages** (`/packages/schema`, `/packages/cli`, etc.): patch/minor only → auto-merge safe
- **Web app** (`/apps/web`): split into dev (auto-merge) + production (manual review)
- **Docs app** (`/apps/docs`): split into dev (auto-merge) + production (manual review)

### 2. `.github/workflows/dependabot-auto-merge.yml`

GitHub Actions workflow that:

1. Detects all Dependabot PRs
2. Checks if PR is labeled as "safe" (devDependencies OR patch/minor without "requires-review")
3. Auto-approves safe PRs with rationale
4. Waits for CI to pass (max 10 minutes)
5. Enables GitHub's auto-merge (squash strategy)
6. Leaves unsafe PRs pending for manual review

**Trigger:** Runs on all pull requests to `main`

**Conditions:**

- Only acts on PRs from `dependabot[bot]`
- Requires passing CI checks before merge
- Uses squash merge to keep commit history clean

## What gets auto-merged

✅ **Automatically merged once CI passes:**

- All devDependencies (test frameworks, linters, build tools)
- Patch updates to production packages (bug fixes)
- Minor updates to production packages (new backward-compatible features)
- **Security patches** (CVE fixes, even if major version) — _high urgency, low risk_

❌ **Requires manual review:**

- Major version bumps (Next.js 15→16, etc.) — unless they're security patches
- Production dependencies not explicitly allowed
- Any PR labeled "requires-review" — except security patches

## What to watch for

1. **CI failures:** If a Dependabot PR fails CI, auto-merge is blocked. Review the error and decide:
   - Is it a real incompatibility? → Manual fix or manual rejection
   - Is it a flaky test? → Re-run CI or merge manually

2. **Security patches:** Now auto-merged at all severity levels (low, medium, high, critical). The approval comment will clearly identify them:
   - Look for `🔒 Auto-approved: Security patch` in the PR comment
   - Verify CI tests pass (they're gated behind full CI run)
   - Merged via squash merge for clean history

3. **Monorepo issues:** Web and docs apps have both auto-merge and manual-review rules to balance safety with developer experience.

## Performance impact

- **Devs:** Zero overhead. PRs auto-merge while you work on other things.
- **CI:** One full test run per Dependabot PR. Runs on Linux + Windows per `.github/workflows/ci.yml`.
- **Review time:** ~0 seconds for safe updates, on-demand for risky ones.

## Disabling auto-merge

To temporarily disable auto-merge or change the strategy:

1. **Disable entirely:** Comment out the `dependabot-auto-merge.yml` workflow
2. **Change scopes:** Edit `.github/dependabot.yml` labels and allow/ignore rules
3. **Change merge method:** Update `dependabot-auto-merge.yml` to use `merge` or `rebase` instead of `squash`

## Testing the setup

### Automatic testing

After pushing these files, the workflow starts on next pull request:

1. Wait for a new Dependabot PR to arrive (weekly on Mondays)
2. Check the PR for:
   - Expected labels (e.g., "devDependencies", "cli", "requires-review", "security")
   - Auto-approval comment from the workflow with reasoning
   - Auto-merge badge once CI passes
3. Monitor GitHub Actions to see the workflow logs

### Testing security patch behavior

To verify security patch auto-merge works:

1. **Check a recent security alert:** Visit https://github.com/AlignTrue/aligntrue/security/dependabot
2. **Wait for next Dependabot run** (Mondays, or trigger manually with `gh workflow run`)
3. **Look for security-specific comment:** If Dependabot creates a PR with "security" label or "Dependabot security update" in body, the workflow will:
   - Show `🔒 Auto-approved: Security patch` comment
   - Run full CI (Linux + Windows)
   - Auto-merge once CI passes
4. **Validate in GitHub Actions:** Check `.github/workflows/dependabot-auto-merge.yml` logs to see security detection logic

## Related documentation

- [GitHub Dependabot docs](https://docs.github.com/en/code-security/dependabot)
- [GitHub auto-merge API](https://docs.github.com/en/rest/pulls/merges?apiVersion=2022-11-28#enable-auto-merge-for-a-pull-request)
- [CI guide](/docs/06-development/ci)
