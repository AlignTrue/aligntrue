---
title: Dependabot auto-merge
description: Hybrid approach to automatically merging Dependabot PRs while preserving manual review for higher-risk changes
---

# Dependabot auto-merge strategy

This document explains AlignTrue's hybrid approach to automatically merging Dependabot PRs.

## Overview

**Goal:** Save maintainer time on routine dependency updates while preserving manual review for higher-risk changes.

**Strategy (matches the workflow logic):**

- Auto-merge when the PR is from Dependabot **and**:
  - Labeled `devDependencies`, **or**
  - Detected as a security patch, **or**
  - Title includes `patch`/`from` **and** the PR is **not** labeled `requires-review`
- Manual review for PRs labeled `requires-review` or anything without a safe signal

## Configuration

### 1. `.github/dependabot.yml`

Dependabot is configured to:

- Create separate PRs per directory (workspace isolation)
- Label PRs by scope (devDependencies, schema, cli, web, docs, etc.)
- Group updates by risk (dev vs production)
- Ignore unsafe updates (e.g., Next.js major versions)

**Key scopes:**

- **Root `/`**: dev-dependencies only → auto-merge safe (labeled `devDependencies`)
- **Packages** (`/packages/schema`, `/packages/cli`, `/packages/mcp`): patch/minor only → auto-merge safe (no `requires-review` label applied)
- **Web app** (`/apps/web`): dev deps auto-merge; production deps labeled `requires-review` → manual
- **Docs app** (`/apps/docs`): dev deps auto-merge; production deps labeled `requires-review` → manual

### 2. `.github/workflows/dependabot-auto-merge.yml`

GitHub Actions workflow that:

1. Detects all Dependabot PRs
2. Checks if PR is labeled as "safe" (`devDependencies`, security, or title includes `patch`/`from` without `requires-review`)
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

✅ **Automatically merged once CI passes (safe signals):**

- Any PR with `devDependencies` label (all scopes)
- PRs Dependabot marks as security patches (label or body text)
- PR titles containing `patch`/`from` **without** `requires-review` label (covers patch/minor in scoped packages; majors would only pass if no `requires-review` label is applied)

Note: The workflow does not explicitly parse minor updates; Dependabot titles include `from`, so the title check covers patch/minor (and majors if a `requires-review` label is missing).

❌ **Requires manual review (no safe signal):**

- PRs labeled `requires-review` (runtime deps for web/docs, or other scopes you opt in)
- Any PR missing a safe signal (e.g., custom scopes without `devDependencies` label)
- Security patches still auto-approve/merge unless you remove that behavior

## What to watch for

1. **CI failures:** If a Dependabot PR fails CI, auto-merge is blocked. Review the error and decide:
   - Is it a real incompatibility? → Manual fix or manual rejection
   - Is it a flaky test? → Re-run CI or merge manually

2. **Security patches:** Auto-merged at all severity levels. The approval comment will clearly identify them:
   - Look for `🔒 Auto-approved: Security patch` in the PR comment
   - Verify CI tests pass (they're gated behind full CI run)
   - Merged via squash merge for clean history
3. **Label coverage:** Manual review depends on `requires-review` labels. If you add new production scopes, ensure Dependabot applies `requires-review` or restricts update types; otherwise majors could be treated as safe due to the title check.
4. **Monorepo balance:** Web and docs apps have both auto-merge and manual-review rules to balance safety with developer experience.

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
   - Expected labels (e.g., `devDependencies`, `cli`, `requires-review`, `security`)
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

### Testing manual-review coverage

To confirm majors and other risky updates stay manual:

1. Create or wait for a PR in a scope that should require review (e.g., `apps/web` runtime deps).
2. Verify the PR has `requires-review` label.
3. Confirm the workflow does **not** auto-approve and leaves the PR pending review.

## Related documentation

- [GitHub Dependabot docs](https://docs.github.com/en/code-security/dependabot)
- [GitHub auto-merge API](https://docs.github.com/en/rest/pulls/merges?apiVersion=2022-11-28#enable-auto-merge-for-a-pull-request)
- [CI guide](/docs/06-development/ci)
