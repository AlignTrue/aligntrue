---
title: "How sync works"
description: "The complete technical truth about two-way sync, defaults, and what actually happens"
---

# How sync works

This document is the source of truth for what AlignTrue actually does. No marketing, no aspirations—just the real behavior.

## Default behavior (the important part)

**When you run `aligntrue sync`:**

1. **Load config** from `.aligntrue/config.yaml`
2. **Check for team mode** - if enabled, validate lockfile
3. **Detect edited agent files** by checking modification times (mtime)
4. **Merge edited files** using last-write-wins strategy (no conflicts, no prompts)
5. **Export** merged rules to all configured agent files
6. **Done** - no interaction required

**Key facts:**

- ✅ Two-way sync is **on by default** (`sync.two_way: true`)
- ✅ Merging is **automatic** (no prompts)
- ✅ Uses **last-write-wins** (most recently modified file's version is used)
- ✅ Works in **both solo and team mode**
- ❌ No conflict detection between agent files
- ❌ No prompts for user decisions

## What "two-way sync" actually means

**Not:** "Automatic background sync that watches for changes"

**Actually:** "When you run `aligntrue sync`, it detects and merges agent file edits"

The system is **explicit, not automatic:**

- Edits are only merged when you run `aligntrue sync`
- All changes happen in one command
- Deterministic behavior (same input = same output every time)

## Configuration

### Solo mode (default)

```yaml
# .aligntrue/config.yaml (created by aligntrue init)
mode: solo # No team features

sync:
  two_way: true # Default - enable edit detection
```

**Behavior:**

- Edit any agent file → run `aligntrue sync` → changes merge everywhere
- No lockfile validation
- No approval workflow
- Fastest feedback loop

### Team mode (opt-in)

```yaml
mode: team # Enable team features
modules:
  lockfile: true # Validate bundle hashes

sync:
  two_way: true # Still works

lockfile:
  mode: soft # Warn on drift (default)
  # or: strict                # Block on drift
```

**Behavior:**

- Edit files → changes merge → validated against lockfile
- If hash not approved: warn (soft) or block (strict)
- Team lead approves via `aligntrue team approve`

## The three sync scenarios

### 1. Solo developer, default config

```bash
# Default: sync.two_way: true
aligntrue sync
```

**Flow:**

```
Step 1: Detect edited agent files by mtime
  ✓ AGENTS.md - mtime: 11:30 AM
  ✓ .cursor/rules/aligntrue.mdc - mtime: 11:45 AM (newest)

Step 2: Merge to IR (last-write-wins)
  • .cursor/rules/aligntrue.mdc sections take precedence
  • Both files' sections merged into .aligntrue/.rules.yaml

Step 3: Export to all agents
  ✓ .cursor/rules/aligntrue.mdc
  ✓ AGENTS.md
  ✓ .vscode/mcp.json
  ✓ etc.

Done! No prompts. Automatic.
```

### 2. Team member with soft lockfile mode

```bash
# Config: lockfile.mode: soft
aligntrue sync
```

**Flow:**

```
Step 1-2: Same as solo (detect and merge)

Step 3: Compute bundle hash from IR
  sha256:abc123...

Step 4: Check allow list
  ❌ Not found (warning)
  ⚠ Sync continues anyway (soft mode)

Step 5: Export to all agents
  ✓ Files written despite hash not approved

Step 6: Team lead reviews later
  aligntrue team approve --current
  # Adds hash to allow list, commits
```

**Result:** Changes go out immediately, team lead approves after the fact.

### 3. Team member with strict lockfile mode

```bash
# Config: lockfile.mode: strict
aligntrue sync
```

**Flow:**

```
Step 1-2: Detect and merge

Step 3: Compute bundle hash
  sha256:def456...

Step 4: Check allow list
  ❌ Not found (blocking)

Step 5a: Interactive terminal (TTY)
  Prompt: "Approve this bundle and continue?"
  • Yes → Add to allow list, export
  • No → Abort, nothing written

Step 5b: Non-interactive (CI, pipe, redirect)
  Error and exit code 1
  Message: "Bundle hash not in allow list (strict mode)"
  Solution shown: "Run: aligntrue team approve --current"
```

**Result:** Nothing happens until approved (team lead or engineer via `--force`).

## Two-way sync details

### How edit detection works

```typescript
// Pseudo-code from packages/core/src/sync/multi-file-parser.ts

function detectEditedFiles(cwd, config) {
  const editedFiles = [];

  // Check each agent file's modification time
  if (existsSync(AGENTS_MD)) {
    const mtime = statSync(AGENTS_MD).mtime;
    // Since lastSyncTime is NOT passed, this is always true
    // So every file is considered "edited" by default
    editedFiles.push({ path: "AGENTS.md", mtime, sections: parsed });
  }

  if (existsSync(CURSOR_MDC)) {
    const mtime = statSync(CURSOR_MDC).mtime;
    editedFiles.push({
      path: ".cursor/rules/aligntrue.mdc",
      mtime,
      sections: parsed,
    });
  }

  return editedFiles;
}
```

**Important:** The mtime check is not comparing against a saved "last sync time". Every agent file is always considered "edited" on every sync. The actual filtering happens at the merge stage (only if sections actually changed).

### How merging works

```typescript
// Pseudo-code from packages/core/src/sync/multi-file-parser.ts

function mergeFromMultipleFiles(editedFiles, currentIR) {
  const sectionsByHeading = new Map();

  // Sort by mtime: oldest first, so newest wins
  const sorted = editedFiles.sort(
    (a, b) => a.mtime - b.mtime, // Ascending
  );

  for (const file of sorted) {
    for (const section of file.sections) {
      const key = section.heading.toLowerCase();

      // Last-write-wins: newer file replaces older
      sectionsByHeading.set(key, {
        heading: section.heading,
        content: section.content,
        sourceFile: file.path,
        mtime: file.mtime,
      });
    }
  }

  return mergedSections;
}
```

**Algorithm:**

1. Sort files by mtime (oldest → newest)
2. Process in order
3. Same heading? Overwrite with newer version
4. Result: newest file's sections always win

**Example:**

```
File A (10:00 AM): ## Security, ## Testing
File B (11:00 AM): ## Security, ## CI/CD

Merge result:
• ## Security ← from File B (newer)
• ## Testing ← from File A (only in A)
• ## CI/CD ← from File B (only in B)
```

## What does NOT happen

### ❌ No conflict detection

There is **no** detection of conflicting edits. If two files have the same section with different content:

```
File A: ## Security
  Content: "Use bcrypt for passwords"

File B: ## Security
  Content: "Use argon2 for passwords"

Result: File B's version wins (if newer by mtime)

No warning. No prompt. Just last-write-wins.
```

### ❌ No automatic background sync

The system does **not** watch files or sync in the background. You must explicitly run `aligntrue sync`.

### ❌ No timestamp tracking for conflict detection

There is no `.aligntrue/.last-sync` file that tracks when the last sync happened. The mtime check is absolute (file modified recently?), not relative to last sync.

### ❌ No prompts for multi-file edits

Even if multiple files changed, there are no prompts. Just automatic merge.

### ❌ No workflow modes

The config has `sync.workflow_mode`, `sync.primary_agent`, and `sync.auto_pull` fields, but they are **not implemented**. Don't use them.

## Practical implications

### For solo developers

**Pro:** Simple, fast, predictable

- Edit in any file
- Run sync
- Everything updates
- Done

**Con:** If you're not careful with edits

- Edit AGENTS.md at 10:00
- Edit .cursor/rules at 10:05 with conflicting content
- Run sync → .cursor/rules wins (it's newer)

**Mitigation:** Pick one file as primary (usually AGENTS.md) and edit there most of the time.

### For teams with soft lockfile mode

**Pro:** Changes go out fast, team lead approves after

- Engineer makes change
- Sync succeeds (warning shown)
- Agent files updated
- Team lead reviews at their pace
- Approve when ready

**Con:** Unapproved changes might reach agents temporarily

- If you want strict control, use strict mode instead

### For teams with strict lockfile mode

**Pro:** Explicit approval required before any change

- Engineer makes change
- Sync blocks or prompts
- Change doesn't go out until approved
- Audit trail in git history

**Con:** Requires team coordination

- Someone needs to approve
- Or use `--force` (not recommended)

### For teams with central rule management

**Pro:** Single source of truth

- Team lead maintains rules in central repo
- Engineers pull rules, can't edit locally
- All changes reviewed before publication

**Con:** Requires different workflow

- Engineers can't make quick local changes
- Must go through team lead review

## Disabling two-way sync

If you want **only** IR → agents export (no agent→IR merge):

```yaml
sync:
  two_way: false
```

Then:

- Agent file edits are ignored
- Only IR is used as source
- Agent files are treated as read-only exports

## Exit codes and errors

### Successful sync

```bash
$ aligntrue sync
✓ Sync complete

$ echo $?
0
```

### Team mode: strict lockfile, unapproved (non-interactive)

```bash
$ aligntrue sync
✗ Bundle hash not in allow list (strict mode)

$ echo $?
1
```

### Team mode: unapproved, but --force flag

```bash
$ aligntrue sync --force
⚠ Bypassing allow list validation (--force)
✓ Sync complete

$ echo $?
0
```

## The actual defaults

| Setting            | Default         | Actual Behavior                             |
| ------------------ | --------------- | ------------------------------------------- |
| `mode`             | `solo`          | No lockfile, no team features               |
| `sync.two_way`     | `true`          | Detect and merge agent file edits           |
| `lockfile.mode`    | (N/A solo)      | Soft (team mode) - warn on drift            |
| Conflict handling  | Last-write-wins | Most recent file's version used, no prompts |
| Prompts            | None            | All merges automatic                        |
| Timestamp tracking | None            | No `.last-sync` file used                   |
| Workflow modes     | Not implemented | Fields exist but ignored                    |
| Primary agent      | Not implemented | Fields exist but ignored                    |

## Common questions

**Q: Can I have Cursor and AGENTS.md in sync?**
A: Yes, by default. Edit either one, run `aligntrue sync`, both stay synchronized.

**Q: What if I edit both files before syncing?**
A: Last-write-wins by mtime. Whichever you edited more recently is used.

**Q: Can I prevent edits to certain files?**
A: Not at the file level. In team mode, you can use lockfile validation to block unapproved changes.

**Q: What happens if both files have the same section but I edited different sections in each?**
A: Sections are independent. Both are kept unless there's a heading conflict. If same heading, newer file wins.

**Q: Is there a `.last-sync` file I should commit?**
A: No. That file is not used in the current implementation.

**Q: What does `sync.primary_agent` do?**
A: It's a configuration field but not implemented. Don't use it.

**Q: Can I set up automatic syncing?**
A: No. Use `aligntrue watch` for continuous file watching, or CI/CD for scheduled syncs.

## Related pages

- [Two-way sync guide](/docs/01-guides/00-two-way-sync) - For practical examples
- [Workflows and scenarios](/docs/01-guides/workflows) - Real-world workflows
- [Sync behavior](/docs/03-concepts/sync-behavior) - Technical reference
