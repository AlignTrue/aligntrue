---
title: "Two-way sync & edit source"
description: "Configure bidirectional sync: choose which files to edit and how changes merge back to rules. Supports single file, multiple files, or flexible workflows."
---

# Two-way sync and edit source

The `sync.edit_source` setting controls which agent files accept your edits and will sync back to AlignTrue's internal rules (IR). By default, AlignTrue detects your agents and recommends the best edit source for your workflow.

**Quick navigation:** For technical details about how sync actually works, see [Sync behavior](/docs/03-concepts/sync-behavior). For practical workflows, stay here.

**Deprecation notice:** The `sync.two_way` boolean is deprecated. Use `sync.edit_source` instead. Existing configs automatically migrate:

- `two_way: false` → `edit_source: ".rules.yaml"`
- `two_way: true` → `edit_source: "any_agent_file"`

## How it works

When you run `aligntrue sync`:

1. **Detect edited files** - Checks which files match your `edit_source` configuration and were modified since last sync
2. **Merge sections** - Combines edited sections back into the IR using last-write-wins strategy
3. **Export to all agents** - Regenerates all agent files from the updated IR
4. **Mark read-only files** - Files not in `edit_source` get HTML comments warning against edits

**Fast. Safe. Automatic.**

## Example workflows

### Single-file editing (recommended for most)

Edit AGENTS.md as your primary source:

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: "AGENTS.md"
```

```bash
# Edit your rules file
nano AGENTS.md  # Add a new section

# Sync everywhere
aligntrue sync
# Output: Detected edit to AGENTS.md
#         Updated all agents
```

### Multi-file with Cursor

Edit Cursor rules in separate scope files:

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: ".cursor/rules/*.mdc"
  scope_prefixing: "auto"
```

```bash
# Edit backend-specific rules
nano .cursor/rules/backend.mdc

# Sync to all agents with scope awareness
aligntrue sync
# Output: Detected edit to .cursor/rules/backend.mdc
#         Routed sections to correct scope
#         Updated AGENTS.md with scope prefixes
```

### Flexible multi-file

Allow editing any agent file:

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: ["AGENTS.md", ".cursor/rules/*.mdc"]
```

```bash
# Can edit either file
nano AGENTS.md
# OR
nano .cursor/rules/backend.mdc

# Changes merge automatically
aligntrue sync
```

### Multiple files edited

If you edit multiple files between syncs:

```
Edit AGENTS.md (10:30 AM)
Edit .cursor/rules/aligntrue.mdc (11:00 AM)
Run aligntrue sync (11:30 AM)

Result: Last-write-wins
- Sections in .cursor/rules/aligntrue.mdc take precedence
- (because it has a newer mtime)
```

**Best practice:** Edit consistently in one file to avoid confusion. Pick `AGENTS.md` for the primary source, or configure a different primary agent in your workflow.

### Conflict detection

When the same section is edited in multiple files, AlignTrue detects the conflict and shows a prominent warning:

```bash
aligntrue sync

⚠️  CONFLICTS DETECTED

Section "Security practices" edited in multiple files:
    AGENTS.md (modified 10:30 AM)
  ✓ .cursor/rules/aligntrue.mdc (modified 11:00 AM)
  → Using: .cursor/rules/aligntrue.mdc (most recent)

Run 'aligntrue sync --show-conflicts' to see detailed changes
```

**What happens:**

- The most recent version wins (last-write-wins)
- A warning is displayed so you know which version was chosen
- Your changes are preserved in automatic backups

**To see detailed differences:**

```bash
aligntrue sync --show-conflicts
```

This shows the actual content from each conflicting file, helping you verify the right version was kept.

**To recover discarded changes:**

```bash
# List backups
aligntrue backup list

# Restore from backup
aligntrue backup restore --to <timestamp>

# Or preview changes
aligntrue revert --preview
```

## IR-only mode (advanced)

To sync **only** IR → agents (no agent file edits detected):

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: ".rules.yaml"
```

Then `aligntrue sync` will only export IR to agent files, ignoring any edits to agent configs. Agent files become read-only with warning markers.

## Team mode implications

In team mode with lockfile validation:

- Two-way sync **still works** for IR merging
- **But** changes are validated against the lockfile
- Team lead must approve via `aligntrue team approve`
- CI enforces via `aligntrue drift --gates`
- **Team-managed sections** can be defined to control specific sections
  - Marked with `[TEAM-MANAGED]` in exports
  - Local edits preserved in backups
  - See [Team-managed sections guide](/docs/01-guides/team-managed-sections)

Example:

```bash
# Team member edits AGENTS.md
# Run aligntrue sync
# → Detects edit, merges to IR
# → Tries to export but blocked by lockfile validation
# Error: Bundle hash not in allow list (strict mode)
#
# Team lead reviews the change:
aligntrue team approve --current
# Now it exports and the new bundle is approved
```

## Dry-run preview

See what would be merged without writing files:

```bash
aligntrue sync --dry-run
```

Output shows:

- Which agent files would be detected as edited
- What the merged IR would look like
- Which files would be written

## Scope-Aware Multi-File Editing

When using Cursor with multiple scope files (e.g., `backend.mdc`, `frontend.mdc`), AlignTrue tracks which file each section originated from using metadata.

### Example Workflow

1. Edit `.cursor/rules/backend.mdc` - add "Backend Security" section
2. Edit `.cursor/rules/frontend.mdc` - add "Frontend Security" section
3. Run `aligntrue sync`
4. Both sections sync to AGENTS.md (optionally with scope prefixes)
5. Next sync routes sections back to correct Cursor files

### Scope Prefixing

Add scope prefixes to AGENTS.md when syncing from multiple Cursor files:

```yaml
sync:
  edit_source: ".cursor/rules/*.mdc"
  scope_prefixing: "auto" # or "always" or "off"
```

Result in AGENTS.md:

```markdown
## Backend: Security

Use authentication for all endpoints.

## Frontend: Security

Sanitize all user inputs.
```

### Managed Sections

Team-managed sections work with any edit_source:

```yaml
managed:
  sections:
    - "Security"
    - "Compliance"
```

These sections remain protected regardless of edit_source.

## Choosing an edit source

### Recommended defaults (auto-detected)

During `aligntrue init`, AlignTrue recommends based on detected agents:

1. **Cursor detected** → `edit_source: ".cursor/rules/*.mdc"`
   - Full feature support with scopes
   - Multi-file editing with scope awareness
   - Best round-trip fidelity

2. **AGENTS.md detected** → `edit_source: "AGENTS.md"`
   - Universal format
   - Single source of truth

3. **Nothing detected** → `edit_source: "AGENTS.md"`
   - Safe default
   - File will be created

### Cursor Priority

If you use Cursor, set:

```yaml
sync:
  edit_source: ".cursor/rules/*.mdc"
```

**Benefits:**

- Full feature support (frontmatter, globs, vendor metadata)
- Multi-scope organization
- Best round-trip fidelity

### AGENTS.md Priority

For universal compatibility:

```yaml
sync:
  edit_source: "AGENTS.md"
```

**Benefits:**

- Single file simplicity
- Works with all AI assistants
- Easy to review in one place

### Both (Flexible)

Allow editing either:

```yaml
sync:
  edit_source: ["AGENTS.md", ".cursor/rules/*.mdc"]
```

**Tradeoff:** May cause conflicts if same section edited in both places.

### All configuration options

```yaml
# Single file (most common)
sync:
  edit_source: "AGENTS.md"

# Glob pattern for multiple Cursor files
sync:
  edit_source: ".cursor/rules/*.mdc"

# Multiple files (allow editing either)
sync:
  edit_source: ["AGENTS.md", ".cursor/rules/*.mdc"]

# Any agent file (maximum flexibility)
sync:
  edit_source: "any_agent_file"

# IR only (advanced)
sync:
  edit_source: ".rules.yaml"
```

## How merge conflicts are resolved

When multiple files in your `edit_source` have the same section:

1. Files are sorted by modification time (oldest first)
2. Newest file's version wins (last-write-wins)
3. Conflicts are logged with file names and timestamps
4. Changes are automatically backed up

**Deterministic and repeatable.** Use `--dry-run` to preview conflicts before syncing.

## Troubleshooting

### Changes not syncing to other agents

1. Did you run `aligntrue sync`? (sync doesn't run continuously)
2. Check your `edit_source`: `aligntrue config get sync.edit_source`
3. Verify the file you edited is in `edit_source`
4. Check sync output for validation errors

Example: If `edit_source: "AGENTS.md"` but you edited `.cursor/rules/backend.mdc`, changes won't sync. Edit AGENTS.md instead.

### Lost changes when editing multiple files

This is last-write-wins behavior. When editing multiple files in `edit_source`:

- Newest file's modification time wins
- Older changes are still in backups

**Best practice:** Use single `edit_source` for clarity, or set `edit_source: ".rules.yaml"` for IR-only editing.

### Files marked as read-only

Files not in your `edit_source` are read-only and will be regenerated on next sync. To edit them:

1. Check current `edit_source`: `aligntrue config get sync.edit_source`
2. Add the file to `edit_source` in `.aligntrue/config.yaml`
3. Run `aligntrue sync` again

### Team mode: Changes blocked after sync

In strict lockfile mode, new edits create a new hash:

```bash
# Team lead must approve
aligntrue team approve --current
```

See [Team Mode](/docs/03-concepts/team-mode) for details.

## Related pages

- [Sync behavior](/docs/03-concepts/sync-behavior) - Technical details
- [Workflows guide](/docs/01-guides/01-workflows) - Choose your editing workflow
- [Team mode](/docs/03-concepts/team-mode) - Lockfile and governance
