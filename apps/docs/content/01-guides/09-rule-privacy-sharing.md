---
description: Control rule privacy, sharing, and synchronization across machines and teams
---

# Rule privacy & sharing

This guide helps you control three independent aspects of your rules: who sees them, whether they need approval, and where they sync.

## Quick decision table

Not sure how to configure your rules? Find your use case below:

| What you want                                      | Go to                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Keep a rule private to just this machine (no sync) | [Scenario 1](#scenario-1-keep-a-rule-private-to-my-machine)      |
| Sync personal rules across all my machines         | [Scenario 2](#scenario-2-sync-personal-rules-across-my-machines) |
| Share team standards normally (approval required)  | [Scenario 3](#scenario-3-share-team-rules-normally)              |
| Publish rules for others to use as a pack          | [Scenario 4](#scenario-4-publish-rules-for-others-to-use)        |

## The three dimensions

Rules have three independent settings you can control:

| Dimension          | Setting                       | What it controls                                | Values                                                                                                |
| ------------------ | ----------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Git visibility** | `gitignore: true/false`       | Is the rule committed to your repo?             | `false` (committed) or `true` (gitignored)                                                            |
| **Approval scope** | `scope: team/personal/shared` | Does it require team approval? (team mode only) | `team` (requires approval), `personal` (bypass approval), `shared` (tracked, routed to shared remote) |
| **Remote routing** | `remotes` config              | Where are rules synced?                         | Personal remote, shared remote, or custom remotes                                                     |

These dimensions are **largely independent**. A rule can be:

- Gitignored but tracked in lockfile
- Personal-scope but committed to the repo
- Gitignored and personal-scope (fully private)
- Shared-scope for publishing

## How data flows: Sources vs Remotes

Understanding the difference between sources and remotes is key to setting up your workflow:

```mermaid
flowchart LR
    subgraph Sources["Sources (Pull)"]
        S1["Remote git repos"]
        S2["Local paths"]
    end
    subgraph Local["Your Project"]
        L["<strong>.aligntrue/rules/</strong><br/>Edit here"]
    end
    subgraph Exports["Exports"]
        E1[".cursor/rules/"]
        E2["AGENTS.md"]
    end
    subgraph Remotes["Remotes (Push)"]
        R1["Personal remote<br/>(scope: personal)"]
        R2["Shared remote<br/>(scope: shared)"]
    end

    S1 -->|Pull on sync| L
    S2 -->|Pull on sync| L
    L -->|Export| E1
    L -->|Export| E2
    L -->|Push if configured| R1
    L -->|Push if configured| R2

    style L fill:#e1f5ff
    style E1 fill:#f3e5f5
    style E2 fill:#f3e5f5
    style R1 fill:#fff3e0
    style R2 fill:#fff3e0
```

### Consumer vs Maintainer roles

| Role           | What you do            | Config    | Example                                           |
| -------------- | ---------------------- | --------- | ------------------------------------------------- |
| **Consumer**   | Pull rules from others | `sources` | Pull TypeScript rules from a shared repo          |
| **Maintainer** | Create and push rules  | `remotes` | Maintain personal rules, push to personal remote  |
| **Both**       | Both pull and push     | Both      | Pull team rules, maintain personal customizations |

You can have multiple roles simultaneously with different rules. For example:

- Pull team standards via `sources`
- Maintain personal preferences locally
- Push personal rules to `remotes.personal`
- Push curated rules to `remotes.shared` for your team

## Common scenarios

### Scenario 1: Keep a rule private to my machine

Use this when the rule is machine-specific or sensitive.

```yaml
---
title: My SSH Configuration
gitignore: true
scope: personal
---
```

**Result:**

- Not committed to git
- Not in lockfile
- Not synced anywhere

### Scenario 2: Sync personal rules across my machines

Use this to access the same personal preferences on all your machines.

```yaml
---
title: My Editor Shortcuts
scope: personal
---
```

Plus configure `.aligntrue/config.yaml`:

```yaml
# Pull personal rules from remote
sources:
  - type: git
    url: git@github.com:yourusername/personal-rules.git
    personal: true

# Push personal rules to the same remote
remotes:
  personal: git@github.com:yourusername/personal-rules.git
```

**Result:**

- Rules committed to your repo
- Not in team lockfile (won't trigger drift)
- Pulled from and pushed to your personal remote
- Accessible on all your machines

### Scenario 3: Share team rules normally

Use this for shared team standards.

```yaml
---
title: Team Security Standards
---
```

No special config needed.

**Result:**

- Committed to git
- Tracked in lockfile (requires team approval to change)
- Stays in main repo only

### Scenario 4: Publish rules for others to use

Use this when you want to share a curated set of rules with your team or the community.

```yaml
---
title: React Best Practices
scope: shared
---
```

Plus configure `.aligntrue/config.yaml`:

```yaml
remotes:
  shared: git@github.com:yourusername/react-rules-pack.git
```

**Result:**

- Committed and tracked in lockfile
- Synced to the shared remote for publishing
- Others can consume via `sources`

## Setting git visibility

Use `gitignore: true` in rule frontmatter to exclude from git:

```yaml
---
title: My Private Notes
gitignore: true
---
# Content here won't be committed
```

AlignTrue will automatically add matching patterns to `.gitignore`.

### Git visibility table

| Setting                      | Behavior                             | Use case                                  |
| ---------------------------- | ------------------------------------ | ----------------------------------------- |
| `gitignore: false` (default) | Rule file committed to git           | Team standards, shared guidelines         |
| `gitignore: true`            | Rule file gitignored (not committed) | Sensitive configs, machine-specific notes |

## Setting approval scope

Use `scope` in rule frontmatter to control lockfile tracking and remote routing:

```yaml
---
title: My Preferences
scope: personal
---
# This rule won't trigger lockfile changes
```

### Scope values and behavior

| Scope            | Lockfile | Remote routing               | Use case                   |
| ---------------- | -------- | ---------------------------- | -------------------------- |
| `team` (default) | Tracked  | Stays in main repo           | Shared team standards      |
| `personal`       | Excluded | Routes to `remotes.personal` | Individual preferences     |
| `shared`         | Tracked  | Routes to `remotes.shared`   | Published rules for others |

**Team-scope rules:**

- Tracked in lockfile (changes require approval)
- Stay in main repo only
- Good for shared standards

**Personal-scope rules:**

- Excluded from lockfile
- Can change freely
- Automatically synced to `remotes.personal` if configured
- Good for individual preferences

**Shared-scope rules:**

- Tracked in lockfile (require team approval)
- Synced to `remotes.shared` for publishing
- Good for rule packs you want to share

## Remote routing with sources and remotes

### Pulling rules from a remote source

Add a git source using the CLI or config:

**CLI:**

```bash
# Add as a connected source (pulls on sync)
aligntrue add source git@github.com:yourusername/personal-rules.git --personal
```

**Config:**

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: git@github.com:yourusername/personal-rules.git
    personal: true
```

The `personal: true` flag on a source:

- Marks all rules from that source as `scope: personal`
- Auto-applies `gitignore: true`
- SSH URLs (`git@...`) automatically get `gitignore: true`

### Pushing rules to remote repositories

Configure remotes using the CLI or config:

**CLI:**

```bash
# Add personal remote (for scope: personal rules)
aligntrue add remote git@github.com:yourusername/personal-rules.git --personal

# Add shared remote (for scope: shared rules)
aligntrue add remote git@github.com:yourusername/shared-rules.git --shared
```

**Config:**

```yaml
# .aligntrue/config.yaml
remotes:
  # Personal-scope rules go here
  personal: git@github.com:yourusername/personal-rules.git

  # Shared-scope rules go here (for publishing)
  shared: git@github.com:yourusername/shared-rules.git

  # Optional: fine-grained pattern-based routing
  custom:
    - id: typescript
      url: git@github.com:yourusername/typescript-rules.git
      include: ["typescript*.md", "eslint*.md"]
```

### How routing works

1. **Scope-based routing** (primary): Rules are routed based on their `scope` frontmatter
   - `scope: personal` rules → `remotes.personal`
   - `scope: shared` rules → `remotes.shared`
   - `scope: team` rules → stay in main repo only

2. **Custom pattern routing** (additive): Use `custom` for fine-grained control
   - Files matching patterns go to those remotes **in addition** to scope-based routing
   - A rule can go to multiple destinations
   - Useful for creating thematic bundles (e.g., all TypeScript rules)

## Best practices

### Do

- Use `gitignore: true` for rules with sensitive content
- Use `scope: personal` for individual preferences in team mode
- Use `scope: shared` for rules you want to publish to others
- Use `sources` with `personal: true` to pull personal rules from remote
- Configure `remotes.personal` to sync personal rules across machines
- Use `remotes.shared` to publish curated rule packs

### Don't

- Use `scope: personal` to bypass team review for shared standards
- Assume gitignored rules are backed up (configure `remotes.personal` for that)
- Configure the same URL as both a source and a remote (creates conflicts)

## Complete workflow example

Setting up personal rules that sync across machines:

**Step 1: Create a private repo**

```bash
# On GitHub, create: aligntrue-personal-rules (private)
```

**Step 2: Configure AlignTrue**

Using CLI commands:

```bash
# Import existing rules from your personal repo (one-time copy)
aligntrue add git@github.com:yourusername/aligntrue-personal-rules.git

# OR add as connected source (pulls updates on sync)
aligntrue add source git@github.com:yourusername/aligntrue-personal-rules.git --personal

# Add as push destination
aligntrue add remote git@github.com:yourusername/aligntrue-personal-rules.git --personal
```

Or configure directly in YAML:

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: git@github.com:yourusername/aligntrue-personal-rules.git
    personal: true

remotes:
  personal: git@github.com:yourusername/aligntrue-personal-rules.git

exporters:
  - cursor
  - agents
```

**Step 3: Create a personal rule**

```yaml
---
title: My Shortcuts
scope: personal
---
## VS Code Shortcuts

- Cmd+Shift+L: Format document
- Cmd+Shift+U: Convert to uppercase
```

**Step 4: Sync**

```bash
aligntrue sync
```

Now your personal rules are:

- Pulled from your personal repo on every sync
- Available locally in `.aligntrue/rules/`
- Exported to your agents
- Pushed back to your personal repo

On another machine, just clone the project and run `aligntrue sync`—your personal rules sync automatically!

## Troubleshooting

### Rule still showing in git status after marking gitignore

Run sync again to update `.gitignore`:

```bash
aligntrue sync
git status
```

If still showing, manually remove from git cache:

```bash
git rm --cached .aligntrue/rules/rulename.md
git status  # Should now be gitignored
```

### Personal-scope rules still in lockfile

Make sure `scope: personal` is in the rule's frontmatter:

```yaml
---
title: My Rule
scope: personal
---
```

Then sync and verify:

```bash
aligntrue sync
cat .aligntrue.lock.json | grep rulename  # Should NOT appear
```

### Rules not syncing to remotes

Check your configuration:

1. Is `remotes` configured?
2. Do your rules have the correct `scope`?
3. Is the remote URL accessible? Try: `git ls-remote <url>`
4. Check for conflicts: same URL as a source? (not allowed)

Run verbose sync to see details:

```bash
aligntrue sync --verbose
```

## Related

- [Team Mode](/docs/03-concepts/team-mode) - How approval scopes work in team workflows
- [Managing Sources](/docs/01-guides/07-managing-sources) - Adding and customizing external rules
- [Personal Repository Setup](/docs/04-reference/personal-repo-setup) - SSH and HTTPS configuration
- [Remote Access Troubleshooting](/docs/05-troubleshooting/remote-access) - Resolving connection issues
