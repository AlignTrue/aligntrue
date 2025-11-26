---
title: "Sync issues"
description: "Troubleshooting common sync problems: missing files, incomplete merges, and detection issues"
---

# Sync issues

Common problems when running `aligntrue sync` and how to fix them.

## Why aren't my new files syncing?

**Symptom:** You added new rule files (e.g., `testing.md`, `security.md`) to `.aligntrue/rules/` but they're not showing up in sync.

**Causes:**

1. **Files not in `.aligntrue/rules/` directory** (most common)
2. **Files have no content or sections**
3. **Watch mode not picking up changes**

**Fix:**

1. **Verify file is in the rules directory:**

   ```bash
   ls -la .aligntrue/rules/
   ```

   Rules must be stored in `.aligntrue/rules/` with `.md` extension. This is the single source of truth.

2. **Verify file has content:**

   ```bash
   # File must have markdown headings (## or ###)
   cat .aligntrue/rules/testing.md
   ```

   If the file is empty or has no headings, AlignTrue won't detect sections.

3. **For watch mode**, new files are logged but not auto-synced:

   ```bash
   # Stop watch
   Ctrl+C

   # Run sync to pick up new files
   aligntrue sync

   # Restart watch
   aligntrue watch
   ```

**Example:**

```bash
# 1. Create new rule file
echo "## Testing rules" > .aligntrue/rules/testing.md

# 2. Run sync to detect and merge
aligntrue sync

# 3. Verify rules are exported to all agents
cat AGENTS.md | grep -A 5 "Testing rules"
```

## Missing sections after sync

**Symptom:** After syncing, some sections from your files are missing in the output.

**Causes:**

1. **Duplicate sections** (first-wins precedence applied)
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

**AlignTrue's behavior:** When the same section appears in multiple files, first-wins precedence is applied (local rules always first, then external sources in order).

## Sync shows no changes but files are different

**Symptom:** You edited files but `aligntrue sync` says "no changes detected."

**Causes:**

1. **File not in `.aligntrue/rules/` directory**
2. **File modification time not updated**
3. **Editing read-only exports** (agent files)

**Fix:**

1. **Check if you edited the source file:**

   ```bash
   ls -la .aligntrue/rules/
   ```

   Edit files in `.aligntrue/rules/`, not agent files like `.cursor/rules/*.mdc` or `AGENTS.md`.

2. **Verify agent files are read-only exports:**

   ```bash
   # Agent files have read-only warnings
   head -20 .cursor/rules/aligntrue.mdc
   head -20 AGENTS.md
   ```

   If you see `<!-- WARNING: READ-ONLY FILE`, edit `.aligntrue/rules/` instead.

3. **Touch file to update mtime if needed:**

   ```bash
   touch .aligntrue/rules/global.md
   aligntrue sync
   ```

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
