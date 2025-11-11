---
title: "Workflows and scenarios"
description: "Real-world scenarios: what happens as a solo dev vs team lead vs team member"
---

# Workflows and scenarios

AlignTrue works differently depending on your setup. Here's what actually happens in each scenario.

## Solo developer (default)

**Default config:**

```yaml
mode: solo # No lockfile/team features
sync:
  two_way: true # Edit any file, changes merge automatically
```

### Scenario: Two-way sync enabled (default)

**Your workflow:**

```bash
# Option A: Edit AGENTS.md (primary rules)
echo "## New Rule" >> AGENTS.md
aligntrue sync
# → Detects AGENTS.md changed
# → Merges to IR
# → Exports to .cursor/rules/*.mdc, AGENTS.md, others
```

or

```bash
# Option B: Edit Cursor config directly
nano .cursor/rules/aligntrue.mdc
aligntrue sync
# → Detects .cursor/rules/aligntrue.mdc changed
# → Merges to IR
# → Exports to AGENTS.md, other agent files
```

**Key points:**

- **No prompts.** Changes are automatically merged.
- **Last-write-wins:** If you edited multiple files, the most recently modified one wins.
- **Automatic round-trip:** Edit anywhere, sync everywhere.

### Scenario: Multiple files edited before sync

```bash
# 10:30 AM: Edit AGENTS.md
echo "## Security" >> AGENTS.md

# 11:00 AM: Edit Cursor config
nano .cursor/rules/aligntrue.mdc

# 11:30 AM: Sync
aligntrue sync

# Output:
# ◇ Detected 2 edited files:
#   • .cursor/rules/aligntrue.mdc (11:00 AM) ← NEWEST, wins
#   • AGENTS.md (10:30 AM)
# ◇ Merged using last-write-wins strategy
# ◇ All files synced
```

**Result:** If both files had the same section, `.cursor/rules/aligntrue.mdc`'s version is used because it's newer.

**Best practice:** Edit in one file consistently (usually `AGENTS.md`) to avoid confusion.

### Scenario: Two-way sync disabled

```yaml
sync:
  two_way: false # Only export IR → agents, no agent→IR merge
```

```bash
# Edit AGENTS.md
echo "## New Rule" >> AGENTS.md
aligntrue sync
# → IGNORES the edit (two-way off)
# → Only exports IR to agent files
# → Changes to AGENTS.md are overwritten!
```

**Use case:** If you want strict IR-source workflow where agents are read-only exports.

---

## Team with shared rules (lockfile enabled)

**Config:**

```yaml
mode: team # Enable lockfile validation
modules:
  lockfile: true # All syncs validated

sync:
  two_way: true # Still works, but validated

lockfile:
  mode: soft # Warn on drift (default)
  # or strict                 # Block on drift
```

### Scenario: Team member edits, no approval needed (soft mode)

**Team member workflow:**

```bash
# Edit AGENTS.md
echo "## Testing" >> AGENTS.md

aligntrue sync
# ◇ Resolving sources...
# ◇ Detected 1 edited file(s)
# ◇ Merged changes from AGENTS.md to IR
# ◇ Computing bundle hash: sha256:abc123...
#
# ⚠ Bundle hash not in allow list (soft mode)
#   Current bundle: sha256:abc123...
#   Sync will continue. To approve:
#     aligntrue team approve --current
#
# ◇ Synced to 3 agents
# ✓ Sync complete
```

**What happened:**

1. Edit detected and merged (two-way sync)
2. New bundle hash computed
3. Not in allowed list → warning (soft mode allows it anyway)
4. Changes exported to all agents
5. Team lead reviews later

**Next step:** Team lead approves with diff preview:

```bash
aligntrue team approve --current
# Approve Rule Sources
# Loading bundle diff...
#
# Changes in this bundle:
#
# Added 1 section(s):
#   + API Standards (23 lines)
#
# Approve these changes? (y/N) › y
#
# ✓ Added sha256:abc123... to allow list
# Remember to commit .aligntrue/allow.yaml
```

**Interactive mode** (default when TTY detected):

- Shows diff preview automatically
- Prompts for confirmation
- Skip with `--no-preview` flag

**Non-interactive mode** (CI/scripts):

- No diff preview shown
- No prompts
- Use `--preview` flag to force preview

### Scenario: Team member edits, approval required (strict mode)

**Config:**

```yaml
lockfile:
  mode: strict # Block until approved
```

**Team member workflow:**

```bash
# Edit AGENTS.md
echo "## API Standards" >> AGENTS.md

aligntrue sync
# ◇ Detected 1 edited file(s)
# ◇ Merged changes from AGENTS.md to IR
# ◇ Computing bundle hash: sha256:def456...
#
# ⚠ Bundle hash not in allow list (strict mode)
#   Current bundle: sha256:def456...
#
# Interactive mode: Approve this bundle and continue sync?
# (Y/n):
```

**If team member says yes:**

- Bundle approved and added to allow list
- Changes exported to all agents
- Team lead commits the approval

**If team member says no:**

- Sync cancelled
- Changes are NOT exported
- Nothing written

**Result:**

```bash
✓ Bundle approved and added to allow list
  Remember to commit .aligntrue/allow.yaml

# Team lead reviews and merges:
git add .aligntrue/allow.yaml
git commit -m "Approve API Standards update"
git push
```

---

## Team lead manages all rules (fully controlled)

**Goal:** Team lead reviews every change before it goes to agents

**Config:**

```yaml
mode: team
modules:
  lockfile: true

lockfile:
  mode: strict # Block unapproved changes

managed:
  source_url: "https://github.com/company/rules" # Central repo
```

**Workflow:**

```bash
# Team lead maintains in central repo (not engineer repos)
# Engineers get rules via git source

# Engineer's config:
sources:
  - type: git
    url: https://github.com/company/rules
    ref: main  # Always use approved version
```

### Scenario: Team lead wants to update rules

**In central repo:**

```bash
# Team lead edits AGENTS.md
echo "## Security Requirements" >> AGENTS.md
git add AGENTS.md
git commit -m "Update security requirements"
git push origin main

# Generates new bundle hash automatically
```

**In engineer repos:**

```bash
# Engineer just syncs (picks up latest from git)
aligntrue sync
# ◇ Resolving sources...
# ◇ Pulling rules from: https://github.com/company/rules
# ◇ Bundle hash matches allow list ✓
# ◇ Synced to all agents
# ✓ Sync complete
```

### Scenario: Engineer tries to edit rules (strict control)

**Engineer edits:**

```bash
# Engineer tries to add a rule locally
echo "## Personal Preference" >> AGENTS.md
aligntrue sync
# ◇ Detected 1 edited file(s)
# ◇ Merged changes from AGENTS.md to IR
# ◇ Computing bundle hash: sha256:new123...
#
# ✗ Bundle hash not in allow list (strict mode)
# Current bundle: sha256:new123...
#
# Non-interactive mode: blocking
# To approve this bundle:
#   aligntrue team approve --current
#
# Or bypass (not recommended):
#   aligntrue sync --force
```

**Result:** Change is blocked. Engineer must:

1. Revert the edit
2. Request change via team lead
3. Team lead updates central repo
4. Engineer syncs again to get approval

**Why this is good:**

- Central source of truth maintained
- All changes reviewed before deployment
- Engineers can't accidentally change rules
- Audit trail of approvals in git history

### Scenario: Engineer tries to bypass with --force

```bash
aligntrue sync --force
# ⚠ Bypassing allow list validation (--force)
#   Bundle hash not approved
#
# ◇ Synced to all agents
# ✓ Sync complete
```

**Consequence:** Change went out without approval. This should be an exceptional case.

**In CI:**

```bash
# CI will catch this
aligntrue drift --gates

# ✗ Drift detected:
#   Lockfile bundle: sha256:original...
#   Current bundle: sha256:new123...
#
# Fix: Get approval from team lead
```

---

## Team with mixed workflow

**Goal:** Core rules managed by team, engineers can add personal sections

**Config:**

```yaml
managed:
  sections:
    - "Security" # Team controls
    - "Compliance" # Team controls
  source_url: "https://github.com/company/rules"

sync:
  two_way: true

lockfile:
  mode: soft # Warn but allow drift
```

**How team-managed sections work:**

Team-managed sections are marked with `[TEAM-MANAGED]` in exported files:

```markdown
<!-- [TEAM-MANAGED]: Controlled by team, local edits preserved in backups -->

## Security

[Team content here]
```

**Workflow:**

```bash
# Engineer adds personal section
echo "## My Preferences" >> AGENTS.md
aligntrue sync

# Team-managed sections detected and marked
# Personal sections coexist with team sections

# If engineer edits team-managed section:
# - Changes backed up automatically
# - Warning shown on sync
# - May be overwritten on next team sync
# - Recoverable via: aligntrue backup restore
```

For details, see [Team-managed sections guide](/docs/01-guides/team-managed-sections).

**Result:**

- Engineer keeps personal section
- Team sections remain intact from central repo
- Warning about drift (but allows it in soft mode)
- Clear marking in exports (`[TEAM-MANAGED]`) shows what's team-controlled

---

## Quick reference: Default behavior

| Scenario                            | Default                 | Behavior                                         |
| ----------------------------------- | ----------------------- | ------------------------------------------------ |
| **Solo dev edits AGENTS.md**        | `sync.two_way: true`    | Auto-merges on next sync                         |
| **Solo dev edits .cursor/\*.mdc**   | `sync.two_way: true`    | Auto-merges on next sync                         |
| **Team member edits (soft mode)**   | `lockfile.mode: soft`   | Warns, allows export                             |
| **Team member edits (strict mode)** | `lockfile.mode: strict` | Prompts or blocks                                |
| **Team lead manages rules**         | Central git source      | Engineers pull, can't edit locally               |
| **Multiple files edited**           | Last-write-wins         | Most recent file's version used                  |
| **No sync run**                     | N/A                     | No automatic merging (must run `aligntrue sync`) |

---

## Key takeaways

1. **Two-way sync is automatic** - Edit any file, changes merge on next `aligntrue sync`
2. **No conflict detection** - Just last-write-wins (predictable, deterministic)
3. **Team governance via lockfile** - Not individual file conflicts
4. **No prompts by default** - Changes happen automatically (solo mode)
5. **Strict mode adds control** - For teams that want explicit approvals
6. **Central source of truth** - Team lead can manage all rules in one repo

For detailed technical info, see [Sync behavior](/docs/03-concepts/sync-behavior).
