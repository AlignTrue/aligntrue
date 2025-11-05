---
title: Choosing a mode
description: Decide between solo and team mode for your AlignTrue workflow
---

# Choosing a mode

AlignTrue has two modes optimized for different workflows. This guide helps you choose the right one.

## Quick decision

**Working alone?** → Use **solo mode** (default)

**Collaborating with a team?** → Use **team mode**

**Not sure?** Start with solo mode. You can always upgrade to team mode later when you need it.

## Feature comparison

| Feature                  | Solo mode             | Team mode                         |
| ------------------------ | --------------------- | --------------------------------- |
| **Lockfile**             | ❌ Disabled           | ✅ Enabled (.aligntrue.lock.json) |
| **Auto-pull**            | ✅ Enabled (default)  | ❌ Disabled (explicit updates)    |
| **Allow lists**          | ❌ Not required       | ✅ Required (approved sources)    |
| **Drift detection**      | ❌ Not available      | ✅ Available (aligntrue drift)    |
| **Bundle generation**    | ❌ Disabled           | ✅ Enabled (dependency merging)   |
| **Backup/restore**       | ✅ Available          | ✅ Available                      |
| **Git integration**      | ✅ Optional           | ✅ Recommended                    |
| **CI/CD validation**     | ✅ Basic checks       | ✅ Full validation + drift gates  |
| **Setup complexity**     | Low (60 seconds)      | Medium (5 minutes)                |
| **Maintenance overhead** | Minimal               | Low to medium                     |
| **Best for**             | Individual developers | Teams and organizations           |

## Scenario-based recommendations

### Solo developer, personal projects

**Recommended:** Solo mode

**Why:**

- Fast iteration with auto-pull
- No lockfile overhead
- Simple setup and maintenance
- Full customization with plugs and overlays

**Example use case:** You're building a side project and want consistent AI agent behavior across your development workflow.

```bash
aligntrue init  # Creates solo mode config by default
aligntrue sync  # Fast, no validation overhead
```

### Solo developer, open source projects

**Recommended:** Solo mode (or team mode if you want reproducibility)

**Why:**

- Solo mode: Fast iteration, contributors can customize
- Team mode: Reproducible builds, consistent contributor experience

**Example use case:** You maintain an open source project and want contributors to follow the same coding standards.

**Solo mode approach:**

```bash
# Commit rules, contributors can customize
git add .aligntrue/
git commit -m "Add AlignTrue rules"
```

**Team mode approach:**

```bash
# Enable team mode for reproducibility
aligntrue team enable
aligntrue sync
git add .aligntrue/ .aligntrue.lock.json
git commit -m "Enable AlignTrue team mode"
```

### 2-5 person team

**Recommended:** Team mode (soft lockfile)

**Why:**

- Reproducible builds across team members
- Drift detection for upstream changes
- Soft lockfile warns but doesn't block
- Allow lists for approved sources

**Example use case:** Small startup team wants consistent AI agent behavior without strict enforcement.

```bash
# Repository owner
aligntrue team enable
# Edit config: lockfile.mode: soft
aligntrue team approve git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml
aligntrue sync
git add .aligntrue/ .aligntrue.lock.json
git commit -m "Enable team mode (soft)"

# Team members
git pull
aligntrue sync  # Validated against allow list
```

### 10+ person team

**Recommended:** Team mode (strict lockfile)

**Why:**

- Strict enforcement prevents drift
- All changes reviewed before merging
- Audit trail for compliance
- Consistent builds across large team

**Example use case:** Engineering team at a growing company needs consistent AI agent behavior with strict enforcement.

```bash
# Repository owner
aligntrue team enable
# Edit config: lockfile.mode: strict
aligntrue team approve git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml
aligntrue sync
git add .aligntrue/ .aligntrue.lock.json
git commit -m "Enable team mode (strict)"

# Team members
git pull
aligntrue sync  # Fails if lockfile doesn't match
```

### Enterprise with compliance requirements

**Recommended:** Team mode (strict) + allow lists

**Why:**

- Approved sources only (security)
- Strict lockfile enforcement (compliance)
- Audit trail (governance)
- Drift detection (monitoring)

**Example use case:** Enterprise team needs to ensure all AI agent rules come from approved sources and are consistently applied.

```bash
# Security team approves sources
aligntrue team approve sha256:abc123...  # Vendored pack
aligntrue team approve internal-standards@org/rules@v2.0.0

# Development teams
aligntrue sync  # Only approved sources allowed
aligntrue drift --gates  # Fail CI if drift detected
```

## When to switch modes

### Solo → Team: When you start collaborating

Switch to team mode when:

- You add team members to your project
- You need reproducible builds
- You want drift detection
- You need approval workflows

**How to switch:**

```bash
# Enable team mode
aligntrue team enable

# Approve current sources
aligntrue team approve git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml

# Generate lockfile
aligntrue sync

# Commit team files
git add .aligntrue/config.yaml .aligntrue/allow.yaml .aligntrue.lock.json
git commit -m "Switch to team mode"
```

### Team → Solo: When forking for personal use

Switch to solo mode when:

- Forking a team project for personal use
- Prototyping without team overhead
- Working on a personal branch

**How to switch:**

```bash
# Edit .aligntrue/config.yaml
# Change: mode: team → mode: solo

# Remove team files (optional)
rm .aligntrue.lock.json .aligntrue/allow.yaml

# Sync
aligntrue sync
```

## What changes when you switch

### Solo → Team changes

| What changes     | Before (solo) | After (team)                                    |
| ---------------- | ------------- | ----------------------------------------------- |
| **Config**       | `mode: solo`  | `mode: team`                                    |
| **New files**    | None          | `.aligntrue.lock.json`, `.aligntrue/allow.yaml` |
| **Auto-pull**    | Enabled       | Disabled                                        |
| **Validation**   | Basic schema  | Schema + allow list + lockfile                  |
| **Sync speed**   | Fast          | Slightly slower (validation)                    |
| **Git workflow** | Optional      | Recommended (commit lockfile)                   |

### Team → Solo changes

| What changes      | Before (team)            | After (solo)          |
| ----------------- | ------------------------ | --------------------- |
| **Config**        | `mode: team`             | `mode: solo`          |
| **Files removed** | Keep lockfile/allow list | Can delete (optional) |
| **Auto-pull**     | Disabled                 | Enabled               |
| **Validation**    | Full validation          | Basic schema only     |
| **Sync speed**    | Validation overhead      | Fast                  |
| **Git workflow**  | Lockfile required        | Optional              |

## Frequently asked questions

### Can I try solo mode first and upgrade later?

Yes! This is the recommended approach. Start with solo mode to learn AlignTrue, then upgrade to team mode when you need reproducibility or collaboration features.

### What happens to my rules when I switch modes?

Your rules stay the same. Only the validation and workflow change. Your `.aligntrue/rules.md` file is unchanged.

### Do I need team mode for open source projects?

Not necessarily. Solo mode works fine for most open source projects. Use team mode if you want:

- Reproducible builds for contributors
- Strict enforcement of approved sources
- Drift detection in CI

### Can team members use different modes?

No. All team members must use the same mode (team mode) for consistent behavior. The mode is set in `.aligntrue/config.yaml` which should be committed to git.

### What's the performance difference?

Solo mode is slightly faster because it skips lockfile and allow list validation. The difference is typically <1 second per sync.

### Can I use team mode without git?

Technically yes, but not recommended. Team mode is designed for git-based collaboration. Without git, you lose the benefits of lockfile versioning and drift detection.

### What if I'm unsure?

Start with solo mode. It's simpler and you can always upgrade later. The switch takes less than 5 minutes.

## Related documentation

- [Quickstart Guide](/docs/00-getting-started/00-quickstart) - Get started with AlignTrue
- [Solo Developer Guide](/docs/01-guides/04-solo-developer-guide) - Complete solo mode workflows
- [Team Guide](/docs/01-guides/05-team-guide) - Complete team mode workflows
- [Team Mode Concepts](/docs/02-concepts/team-mode) - Technical details of team mode
- [FAQ](/docs/00-getting-started/02-faq) - Common questions

## Summary

**Choose solo mode if:**

- You work alone
- You want fast iteration
- You don't need reproducibility
- You're just getting started

**Choose team mode if:**

- You collaborate with others
- You need reproducible builds
- You want drift detection
- You need approval workflows

**Still unsure?** Start with solo mode. You can always upgrade to team mode later when you need it.
