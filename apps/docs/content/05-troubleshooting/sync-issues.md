---
title: "Sync issues"
description: "Troubleshooting common sync problems: missing files, incomplete merges, and detection issues"
---

# Sync issues

Common problems when running `aligntrue sync` and how to fix them.

## Why aren't my new files syncing?

**Symptom:** You added new rule files (e.g., `CLAUDE.md`, `.cursor/rules/new.mdc`) but they're not showing up in sync.

**Causes:**

1. **Files not in `edit_source`** (most common)
2. **Files have no content or sections**
3. **Watch mode not picking up changes**

**Fix:**

1. **Check edit_source configuration:**

   ```bash
   aligntrue config get sync.edit_source
   ```

   If your file isn't covered by the pattern, run sync interactively:

   ```bash
   aligntrue sync
   ```

   AlignTrue will detect the new files and prompt you to import them.

2. **Verify file has content:**

   ```bash
   # File must have markdown headings (## or ###)
   cat CLAUDE.md
   ```

   If the file is empty or has no headings, AlignTrue won't detect it as having content.

3. **For watch mode**, new files are logged but not auto-imported:

   ```bash
   # Stop watch
   Ctrl+C

   # Run sync interactively
   aligntrue sync

   # Restart watch
   aligntrue watch
   ```

**Example:**

```bash
# 1. Check current configuration
aligntrue config get sync.edit_source
# Output: "AGENTS.md"

# 2. You added CLAUDE.md but it's not tracked

# 3. Run sync to detect and import
aligntrue sync

# 4. Prompt appears asking to import CLAUDE.md
# Choose: Import all and merge

# 5. File is now tracked
aligntrue config get sync.edit_source
# Output: ["AGENTS.md", "CLAUDE.md"]
```

## Missing sections after sync

**Symptom:** After syncing, some sections from your files are missing in the output.

**Causes:**

1. **Duplicate sections** (last-write-wins applied)
2. **Files not detected** as edited
3. **Parse errors** in markdown

**Fix:**

1. **Check for conflicts:**

   ```bash
   aligntrue sync --verbose
   ```

   Look for warning messages about duplicate sections.

2. **Review drift log:**

   ```bash
   cat .aligntrue/.drift-log.json
   ```

   Shows which files were detected and their status.

3. **Check file modification times:**

   ```bash
   ls -la AGENTS.md .cursor/rules/*.mdc
   ```

   Only files modified since last sync are processed.

4. **Force a full re-import:**

   ```bash
   # Remove drift log to reset
   rm .aligntrue/.drift-log.json

   # Run sync
   aligntrue sync
   ```

## Duplicate sections in output

**Symptom:** The same section appears multiple times in exported files.

**Causes:**

1. **Same section in multiple source files**
2. **Different headings that look similar**

**Fix:**

1. **Identify duplicates:**

   ```bash
   # Grep for duplicate headings
   grep "^## " AGENTS.md | sort | uniq -c | grep -v "^ *1 "
   ```

2. **Remove duplicates from source files:**

   ```bash
   nano AGENTS.md  # Remove duplicate sections
   nano CLAUDE.md  # Remove duplicate sections
   ```

3. **Sync again:**
   ```bash
   aligntrue sync
   ```

**AlignTrue's behavior:** When the same section appears in multiple files, last-write-wins (most recently modified file) is used.

## Sync shows no changes but files are different

**Symptom:** You edited files but `aligntrue sync` says "no changes detected."

**Causes:**

1. **File not in `edit_source`**
2. **File modification time not updated**
3. **Editing read-only exports**

**Fix:**

1. **Check if file is in edit_source:**

   ```bash
   aligntrue config get sync.edit_source
   ```

2. **Touch file to update mtime:**

   ```bash
   touch AGENTS.md
   aligntrue sync
   ```

3. **Verify you're editing the right file:**

   ```bash
   # Check for read-only warning at top of file
   head -20 .cursor/rules/*.mdc
   ```

   If you see `<!-- WARNING: READ-ONLY FILE`, you should edit the source file listed in the warning instead.

## Watch mode not detecting new files

**Symptom:** You added a new file while `aligntrue watch` is running, but no sync triggered.

**Expected behavior:** Watch mode logs new files but doesn't auto-import them by default.

**What you see:**

```
[Watch] New file detected: CLAUDE.md (5 sections)
  ℹ Run 'aligntrue sync' to review and import
```

**Fix:**

1. **Stop watch and run sync:**

   ```bash
   # In watch terminal: Ctrl+C
   aligntrue sync
   # Choose import strategy
   aligntrue watch  # Restart
   ```

2. **Or enable auto-import (opt-in):**

   ```yaml
   # .aligntrue/config.yaml
   watch:
     on_new_files: "auto_import"
   ```

   Then restart watch:

   ```bash
   aligntrue watch
   ```

## Formatting issues in exported files

**Symptom:** Exported files have missing newlines or malformed markdown.

**Example:**

```markdown
---### Heading
```

Instead of:

```markdown
---

### Heading
```

**Cause:** Source files have formatting issues.

**Fix:**

1. **Check source files for issues:**

   ```bash
   # Look for horizontal rules without spacing
   grep -n "^---[^-]" AGENTS.md CLAUDE.md
   ```

2. **Fix manually or let AlignTrue normalize:**

   ```bash
   # AlignTrue automatically fixes common issues during export
   aligntrue sync
   ```

   The exporter now includes automatic formatting normalization.

## Drift log shows pending files that don't exist

**Symptom:** `.aligntrue/.drift-log.json` references files you've deleted.

**Fix:**

1. **Clear drift log:**

   ```bash
   rm .aligntrue/.drift-log.json
   ```

2. **Or edit manually:**

   ```bash
   nano .aligntrue/.drift-log.json
   # Remove entries for deleted files
   ```

3. **Run sync to rebuild:**
   ```bash
   aligntrue sync
   ```

## Edit source changed unexpectedly

**Symptom:** After running `aligntrue sync`, your `sync.edit_source` configuration changed from one file to another.

**Example:**

- Before: `sync.edit_source` was `"AGENTS.md"`
- After: `sync.edit_source` became `".cursor/rules/*.mdc"`

**Root cause:** AlignTrue auto-detects when multi-file agents (like Cursor) are introduced and automatically switches to that format for better scalability and file organization.

**When this happens:**

1. You create new agent files (e.g., `.cursor/rules/rule1.mdc`, `.cursor/rules/rule2.mdc`)
2. You run `aligntrue sync` with `--yes` flag (non-interactive mode)
3. AlignTrue detects the multi-file structure and auto-switches edit_source
4. The change is logged but may not be obvious in non-interactive mode

**To see what changed:**

```bash
# Check current edit_source
aligntrue config get sync.edit_source

# Review recent sync output
# Look for: "Auto-switching edit_source from X to Y"
```

**Fix if unwanted:**

If you prefer to keep the original edit_source, reset it:

```bash
# Reset to AGENTS.md
aligntrue config set sync.edit_source "AGENTS.md"

# Run sync again
aligntrue sync
```

**To prevent auto-detection:**

Run sync interactively (without `--yes`):

```bash
aligntrue sync
```

This prompts you to confirm the edit_source switch before it happens.

**Best practice:**

- Use interactive mode (`aligntrue sync`) during setup to see and approve changes
- Use non-interactive mode (`aligntrue sync --yes`) in CI after setup is complete
- Document your chosen edit_source in project README so team members know the convention

## Recovering rules after edit source switch

**Symptom:** You switched edit sources (e.g. from `AGENTS.md` to Cursor rules) and need to access your old rules that weren't automatically copied over.

**Fix:**

AlignTrue automatically backs up your old source files before switching. You can find them in the `.aligntrue/overwritten-rules/` directory.

1. **List available backups:**

   ```bash
   ls -la .aligntrue/overwritten-rules/
   ```

   You'll see files with timestamps, e.g., `AGENTS.2025-11-23T10-30-00.md`.

2. **View content:**

   ```bash
   cat .aligntrue/overwritten-rules/AGENTS.2025-11-23T10-30-00.md
   ```

3. **Copy sections back:**
   Manually copy any missing sections from the backup file into your new edit source files (e.g., `.cursor/rules/global.mdc`).

4. **Run sync to update all agents:**
   ```bash
   aligntrue sync
   ```

---

## Getting help

If you're still stuck:

1. **Run with verbose output:**

   ```bash
   aligntrue sync --verbose
   ```

2. **Check debug logs:**

   ```bash
   DEBUG_SYNC=1 aligntrue sync
   ```

3. **Review backup:**

   ```bash
   aligntrue backup list
   ```

4. **File an issue:**
   - Repository: https://github.com/AlignTrue/aligntrue
   - Include verbose output and configuration
