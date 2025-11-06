# Sync behavior

Complete reference for AlignTrue's two-way sync system, conflict resolution, and precedence rules.

> **Comprehensive reference** for sync internals. For practical workflow selection, see [Choosing Your Workflow](/docs/01-guides/01-workflows).

## Overview

AlignTrue synchronizes rules between three locations:

1. **Intermediate Representation (IR)** - `.aligntrue/.rules.yaml` (internal, auto-generated)
2. **User-Editable Files** - `AGENTS.md`, `.cursor/*.mdc`, `.vscode/mcp.json`, etc.
3. **Team Lockfile** - `.aligntrue.lock.json` (team mode only)

The sync engine maintains consistency while allowing both IR→agent and agent→IR flows.

## Sync directions

### IR → Agent (default)

**When:** Every `aligntrue sync` command (default direction)

**Flow:**

```
IR (.aligntrue/.rules.yaml) → Parse → Validate → Export → Agent files
```

**What happens:**

1. Load configuration from `.aligntrue/config.yaml`
2. Parse rules from `.aligntrue/.rules.yaml` (internal IR)
3. Validate against JSON Schema
4. Resolve scopes and merge rules
5. Export to each enabled agent (Cursor, AGENTS.md, etc.)
6. Write agent files atomically (temp+rename)
7. Update lockfile (team mode only)

**Example:**

```bash
# Standard sync
aligntrue sync

# Preview changes
aligntrue sync --dry-run

# Non-interactive (CI)
aligntrue sync --force
```

**Output:**

```
◇ Loading configuration...
◇ Parsing rules...
◇ Syncing to 2 agents...
│
◆ Files written:
│  • .cursor/rules/aligntrue.mdc (3 rules)
│  • AGENTS.md (3 rules)
│
◇ Sync complete! No conflicts detected.
```

---

### Agent → IR (pullback)

**When:**

- **Solo mode (auto-pull):** Automatically before every `aligntrue sync` (default)
- **Team mode (manual):** `aligntrue sync --accept-agent <name>` (explicit opt-in)

**Solo Mode Auto-Pull:**

Solo developers editing native agent formats (`.cursor/*.mdc`, `AGENTS.md`) benefit from automatic pull on sync:

```bash
# Edit native format
vi .cursor/rules/aligntrue-starter.mdc

# Auto-pull happens automatically
aligntrue sync
# ◇ Auto-pull: pulling from cursor
# ✓ Updated IR from cursor
# ✓ Synced to: AGENTS.md
```

**Configuration:**

```yaml
# .aligntrue/config.yaml
exporters:
  - cursor
  - agents-md

# Auto-enabled for solo mode
sync:
  auto_pull: true # Default for solo mode
  primary_agent: cursor # Auto-detected from exporters
  on_conflict: accept_agent # Default for solo mode
```

**Flow:**

```
Agent files → Parse → Detect conflicts → Resolve → IR (.aligntrue/.rules.yaml)
```

**What happens:**

1. Load existing IR from `.aligntrue/.rules.yaml`
2. Parse agent files (`.cursor/*.mdc`, `AGENTS.md`, etc.)
3. Detect conflicts (field-level comparison in team mode, auto-accept in solo mode)
4. Prompt for resolution (interactive mode)
5. Apply changes to IR
6. Write updated `.aligntrue/.rules.yaml`

**Example:**

```bash
# Pull changes from Cursor
aligntrue sync --accept-agent cursor

# Pull from AGENTS.md
aligntrue sync --accept-agent agents-md
```

See [Import Workflow Guide](/docs/04-reference/import-workflow) for detailed migration strategies and coverage analysis.

**Output:**

```
◇ Loading IR from .aligntrue/.rules.yaml...
◇ Parsing Cursor rules from .cursor/rules/*.mdc...
◇ Detecting conflicts...
│
⚠ Warning: Using mock data for agent→IR parsing
│
◆ Changes detected:
│  • 2 rules modified
│  • 1 rule added
│  • 0 rules deleted
│
◇ Conflicts detected. Starting resolution...
```

---

## Precedence rules

### IR wins by default

**.aligntrue/.rules.yaml is the internal authority.**

If you edit both IR and agent files:

- `aligntrue sync` → IR overwrites agent files (no prompt)
- `aligntrue sync --accept-agent` → Triggers conflict resolution

**Recommended workflow:**

1. Edit `AGENTS.md` or agent files
2. Run `aligntrue sync`
3. All agent files updated automatically

### Explicit pullback required

To pull changes from agent files back to IR:

```bash
# Must explicitly opt in
aligntrue sync --accept-agent cursor
```

Without `--accept-agent`, IR always wins.

### Conflict detection

Conflicts detected when:

- Field values differ between IR and agent file
- Rule exists in agent but not in IR (new rule)
- Rule exists in IR but not in agent (deleted rule)

**Field-level granularity:**

```
Conflict in rule 'my-project.backend.use-typescript':
  Field 'severity':
    IR:    error
    Agent: warn
```

---

## Conflict resolution

### Interactive mode (default)

When conflicts detected, you'll see:

```
⚠ Conflict detected in rule 'my-project.backend.use-typescript'

Field 'severity':
  IR:    error
  Agent: warn

[i] Keep IR (discard agent change)
[a] Accept agent (pull agent change to IR)
[d] Show full diff
[q] Quit (abort sync)

Choice:
```

**Options:**

- `i` - Keep IR value, discard agent change
- `a` - Accept agent value, update IR
- `d` - Show complete diff of rule
- `q` - Abort sync, no changes written

### Batch mode

Apply same resolution to all conflicts in a rule:

```
⚠ Multiple conflicts in rule 'my-project.backend.use-typescript'

Apply same resolution to all 3 conflicts? [y/n]: y

[i] Keep IR for all fields
[a] Accept agent for all fields
[q] Quit

Choice:
```

Saves time when you trust one source completely.

### Non-interactive mode

For CI or scripting, use default strategy:

```bash
# Keep IR, discard all agent changes (default)
aligntrue sync --force

# Accept all agent changes (coming in Step 17)
aligntrue sync --accept-agent cursor --force
```

No prompts, uses default resolution strategy.

### Manual edit detection

If sync detects manual edits to generated files:

```
⚠ Checksum mismatch: .cursor/rules/aligntrue.mdc

This file was manually edited since last sync.

[v] View current content
[o] Overwrite (discard manual edits)
[k] Keep manual edits (skip sync)
[a] Abort sync

Choice:
```

**Checksum tracking:**

- AlignTrue computes SHA-256 hash of each generated file
- Stores hash in `.aligntrue/.checksums.json`
- Compares before overwriting

**Best practice:** Edit `AGENTS.md` or agent files, not generated exports.

---

## Scope behavior

### Per-scope exports

Some exporters create one file per scope:

**Cursor (`.cursor/rules/*.mdc`):**

```
.aligntrue/.rules.yaml (with scopes):
  - default scope → .cursor/rules/aligntrue.mdc
  - apps/web scope → .cursor/rules/apps-web.mdc
  - packages/core scope → .cursor/rules/packages-core.mdc
```

**Filename conversion:**

- Scope path → filename
- Forward slashes → hyphens
- Example: `apps/web` → `apps-web.mdc`

**Why per-scope files?**

- Cursor can load rules contextually based on current file
- Smaller files, faster parsing
- Clearer organization

---

### Merged exports

Other exporters merge all scopes into one file:

**AGENTS.md:**

```
.aligntrue/.rules.yaml (with scopes):
  - default scope
  - apps/web scope
  - packages/core scope

→ AGENTS.md (single file, all rules merged)
```

**Scope metadata preserved:**

```markdown
## Rule: use-typescript-strict

**Scope:** apps/web

Use TypeScript strict mode in all files.
```

**Why merged?**

- Universal format for multiple agents
- Simpler for agents without scope support
- Single source of truth at root

---

### Scope merge order

When rules overlap across scopes, merge order determines precedence:

```yaml
# .aligntrue/config.yaml
scopes:
  - name: root
    path: .
    merge_order: [root, path, local]
  - name: apps-web
    path: apps/web
    merge_order: [root, path, local]
```

**Merge order levels:**

- `root` - Workspace-level rules (lowest priority)
- `path` - Scope-specific rules (medium priority)
- `local` - File-level overrides (highest priority)

**Example:**

```yaml
# Root scope defines base rule
id: my-project.global.use-typescript
severity: warn

# apps/web scope overrides severity
id: my-project.global.use-typescript
severity: error  # Stricter in frontend
```

Final merged rule in `apps/web` scope:

```yaml
id: my-project.global.use-typescript
severity: error # apps/web override wins
```

---

## Dry run mode

Preview changes without writing files:

```bash
aligntrue sync --dry-run
```

**Output shows:**

1. **Audit trail** - All operations with timestamps
2. **Files that would be written** - Paths and sizes
3. **Warnings** - Potential issues
4. **Conflicts** - What would trigger prompts
5. **Content hashes** - SHA-256 of each file

**Example:**

```
◆ Dry-run mode: No files will be written

Audit trail:
  [2025-10-27T12:00:00Z] Loaded config from .aligntrue/config.yaml
  [2025-10-27T12:00:01Z] Parsed 3 rules from .aligntrue/.rules.yaml
  [2025-10-27T12:00:02Z] Resolved 2 scopes
  [2025-10-27T12:00:03Z] Exported to cursor (1 file)
  [2025-10-27T12:00:04Z] Exported to agents-md (1 file)

Files to write:
  • .cursor/rules/aligntrue.mdc (2.4 KB, hash: a3b2c1d4...)
  • AGENTS.md (1.8 KB, hash: e5f6a7b8...)

Warnings: None

Conflicts: None
```

**Use cases:**

- Verify changes before committing
- Debug exporter behavior
- Review scope resolution
- CI validation (non-destructive)

---

## Git integration

AlignTrue can automatically manage git operations for generated files.

### Three modes

**1. Ignore Mode (Default)**

```yaml
# .aligntrue/config.yaml
git:
  mode: ignore
```

- Adds generated files to `.gitignore`
- Developers sync locally, don't commit agent files
- Recommended for solo developers

**Behavior:**

```bash
aligntrue sync
# Adds to .gitignore:
#   .cursor/rules/*.mdc
#   AGENTS.md
#   .vscode/mcp.json
```

**2. Commit Mode**

```yaml
# .aligntrue/config.yaml
git:
  mode: commit
```

- Commits generated files automatically after sync
- Team shares agent files via git
- Recommended for teams with consistent agents

**Behavior:**

```bash
aligntrue sync
# After successful sync:
git add .cursor/rules/*.mdc AGENTS.md
git commit -m "chore: sync AlignTrue rules"
```

**3. Branch Mode**

```yaml
# .aligntrue/config.yaml
git:
  mode: branch
```

- Creates feature branch for each sync
- Commit changes to branch
- Developers review before merging

**Behavior:**

```bash
aligntrue sync
# Creates branch: aligntrue/sync-2025-10-27-120000
# Commits changes to branch
# Developer reviews and merges via PR
```

---

### Per-adapter override

Override git mode for specific exporters:

```yaml
# .aligntrue/config.yaml
git:
  mode: ignore # Default for all exporters

exporters:
  - name: cursor
    git_override: commit # Commit Cursor files

  - name: agents-md
    # Uses default (ignore)
```

**Use case:** Commit `.cursor/*.mdc` for team, ignore `AGENTS.md` for personal use.

---

### Idempotent .gitignore

AlignTrue safely manages `.gitignore`:

- Adds entries only if not present
- Preserves existing entries and comments
- Uses markers for AlignTrue-managed section:

```gitignore
# Your existing entries
node_modules/
dist/

# BEGIN AlignTrue
.cursor/rules/*.mdc
AGENTS.md
# END AlignTrue
```

**Safe operations:**

- Running sync multiple times doesn't duplicate entries
- Manual edits outside markers are preserved
- Removing marker comments stops AlignTrue management

---

## Lockfile behavior (team mode)

When team mode enabled (`mode: team` in config):

### Validation before sync

Lockfile validated before syncing:

```yaml
# .aligntrue/config.yaml
lockfile:
  mode: soft # Warn but continue (default)
  # mode: strict  # Block on mismatch (CI)
  # mode: off     # Disable validation
```

**Three modes:**

**Off (Solo Mode):**

- No lockfile validation
- Always succeeds
- Recommended for solo developers

**Soft (Team Mode Default):**

- Warns on lockfile mismatch
- Continues sync anyway
- Exit code 0 (success)

**Strict (CI):**

- Errors on lockfile mismatch
- Aborts sync
- Exit code 1 (failure)

---

### Regeneration after sync

Lockfile regenerated after successful sync (team mode only):

```bash
aligntrue sync
# 1. Validates lockfile (soft/strict)
# 2. Performs sync
# 3. Regenerates .aligntrue.lock.json
```

**Lockfile contents:**

```json
{
  "version": "1",
  "generated_at": "2025-10-27T12:00:00Z",
  "mode": "soft",
  "rules": [
    {
      "rule_id": "my-project.backend.use-typescript",
      "content_hash": "a3b2c1d4e5f6...",
      "source": "local:.aligntrue/.rules.yaml"
    }
  ],
  "bundle_hash": "e5f6a7b8c9d0..."
}
```

**Per-rule hashes:**

- SHA-256 of canonical IR (JCS)
- Excludes `vendor.*.volatile` fields
- Deterministic across machines

**Bundle hash:**

- SHA-256 of sorted rule hashes
- Quick validation before per-rule check

---

### Drift detection

Lockfile drift occurs when:

- Rules edited but lockfile not updated
- Teammate pushed rules without lockfile
- Git merge conflict resolved manually

**Detection:**

```bash
aligntrue sync
# Compares current rules to lockfile hashes
# Reports mismatches
```

**Resolution:**

**Soft mode (warning):**

```
⚠ Warning: Lockfile is out of sync
  Rule 'my-project.backend.use-typescript' hash mismatch

Continuing sync...
```

**Strict mode (error):**

```
✖ Error: Lockfile validation failed
  Rule 'my-project.backend.use-typescript' hash mismatch

Aborting sync. Use --force to override.
```

**Fix:**

```bash
# Regenerate lockfile
aligntrue sync --force

# Or delete and regenerate
rm .aligntrue.lock.json
aligntrue sync
```

---

## Performance considerations

### File operations

AlignTrue optimizes sync performance:

- **Atomic writes** - Temp file + rename (prevents partial writes)
- **Lazy loading** - Only parses files when needed
- **Caching** - Reuses parsed IR across exporters
- **Parallel exports** - Multiple exporters run concurrently

### Large repositories

For monorepos with many scopes:

```yaml
# .aligntrue/config.yaml
scopes:
  - name: backend
    path: packages/backend
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts", "**/node_modules/**"]
```

**Performance tips:**

- Use `exclude` patterns to skip irrelevant files
- Limit scope depth with specific paths
- Enable only needed exporters

### CI optimization

```bash
# Fast validation (no file writes)
aligntrue check --ci

# Faster than full sync in CI
```

---

## Troubleshooting

### Sync hangs or times out

**Cause:** Large rule files, slow disk, or exporter deadlock.

**Fix:**

```bash
# Check file sizes
ls -lh AGENTS.md .aligntrue/.rules.yaml

# Run with dry-run to test
aligntrue sync --dry-run

# Disable problematic exporter
# Edit .aligntrue/config.yaml and remove exporter
```

---

### Conflicts on every sync

**Cause:** Agent and IR are both being edited.

**Fix:**

**Option 1: Native format workflow (recommended)**

- Edit `AGENTS.md` or any agent file
- Run `aligntrue sync` to propagate changes
- Enable bidirectional sync with `auto_pull: true`

**Option 2: Manual control**

- Edit `AGENTS.md` as primary file
- Run `aligntrue sync` to update other agents
- Disable auto-pull with `auto_pull: false`

**Tip:** Use native format workflow for flexibility - edit any file, changes sync everywhere.

---

### Lockfile always out of sync

**Cause:** Volatile vendor fields changing on each sync.

**Fix:**

```yaml
# Mark changing fields as volatile
vendor:
  _meta:
    volatile: ["my-agent.timestamp", "my-agent.cache"]
  my-agent:
    timestamp: "2025-10-27T12:00:00Z" # Excluded from hash
```

Volatile fields won't cause lockfile drift.

---

## See also

- [Command Reference](/docs/04-reference/cli-reference) - Detailed flag documentation
- [Import Workflow](/docs/04-reference/import-workflow) - Migrate from existing agent rules
- [Git Sources Guide](/docs/04-reference/git-sources) - Pull rules from repositories
- [Troubleshooting](/docs/05-troubleshooting) - Common sync issues
- [Extending AlignTrue](/docs/06-contributing/adding-exporters) - Create custom exporters
- [Quickstart Guide](/docs/00-getting-started/00-quickstart) - Get started in <60 seconds
