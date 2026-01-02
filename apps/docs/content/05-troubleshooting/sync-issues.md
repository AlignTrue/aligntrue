---
title: "Sync issues"
description: "Troubleshooting common sync problems: configuration, missing files, lockfile drift, and detection issues"
---

# Sync issues

Common problems when running `aligntrue sync` and how to fix them.

## Config not found

**Error:**

```
✖ Configuration file not found: .aligntrue/config.yaml

Run 'aligntrue init' to set up your project first.
```

**Cause:** Haven't run `aligntrue init` yet, or config file was deleted.

**Fix:**

```bash
# Initialize the project
aligntrue init
```

If you deleted config by accident, recreate it and include at least one rule file:

```yaml
# .aligntrue/config.yaml
mode: solo
exporters:
  - cursor
  - agents
sources:
  - type: local
    path: .aligntrue/rules/
```

```markdown
# .aligntrue/rules/global.md

## defaults

- Keep project rules consistent
```

---

## Source file not found

**Error:**

```
✖ Source file not found: .aligntrue/rules

Check 'sources' in .aligntrue/config.yaml
Hint: Create `.aligntrue/rules/*.md` or update source path
```

**Cause:** Rules file doesn't exist or path is wrong in config.

**Fix:**

**1. Create missing rules file:**

```bash
mkdir -p .aligntrue
# Create a minimal rule file (must be .md with headings)
cat > .aligntrue/rules/global.md <<'EOF'
## defaults
- Keep project rules consistent
EOF
```

**2. Fix path in config:**

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules/ # Directory of .md rule files
```

**3. Verify file exists:**

```bash
ls -la .aligntrue/rules
```

---

## Align sections missing after sync

**Symptoms:**

- Added align appears in `aligntrue sync` output, but `AGENTS.md` and `.cursor/rules/*.mdc` files never show the new sections.
- Running `aligntrue sync` repeatedly keeps overwriting align content with older exports.

**Cause:** Aligns must be authored in `.aligntrue/rules/*.md` with `##` headings. Agent exports (`AGENTS.md`, `.cursor/rules/*.mdc`) are read-only; editing them or omitting the source file leaves nothing to re-export.

**Fix:**

1. Ensure the align file lives in `.aligntrue/rules/*.md` and the directory is listed under `sources` in `.aligntrue/config.yaml`.
2. Use `##` or deeper headings; level-1 (`#`) is treated as the document title and is ignored for sections.
3. Re-run `aligntrue sync` — exports are regenerated from the source rules and will include the align sections.

Still not seeing the sections? Run `aligntrue sync --verbose` to confirm the align was merged and check the file listed under "Sources merged".

---

## Lockfile drift (team mode)

**Error (drift command):**

```bash
aligntrue drift --gates
# ✖ Lockfile drift detected
#   Expected: a3b2c1d4...
#   Actual:   e5f6a7b8...
#
# Exit code: 1
```

**Cause:** Rules changed since lockfile was last generated.

**Note:** `aligntrue sync` automatically updates the lockfile. Use `aligntrue drift --gates` in CI to enforce lockfile validation.

**Fix:**

**1. Intentional changes - regenerate lockfile:**

```bash
# Sync regenerates the lockfile automatically
aligntrue sync

# Commit the updated lockfile
git add .aligntrue/lock.json
git commit -m "chore: update lockfile"
```

**2. Unintentional changes - review diff:**

```bash
# Check what changed
git diff .aligntrue/rules

# Revert unwanted changes
git checkout .aligntrue/rules

# Sync again
aligntrue sync
```

**3. Team workflow - pull latest:**

```bash
# Get latest lockfile from team
git pull

# Sync to your agents
aligntrue sync
```

**Change lockfile mode:**

```yaml
# .aligntrue/config.yaml
lockfile:
  mode: soft # Warn but continue (default in team mode)
  # mode: strict # Block on mismatch (recommended for CI)
  # mode: off    # Disable validation (solo mode)
```

---

## Exporter failures

**Error:**

```
✖ Exporter 'cursor' failed: Invalid configuration
  Output path must be a string, got undefined
```

**Cause:** Exporter configuration missing or invalid.

**Fix:**

**1. Check exporter is enabled:**

```yaml
# .aligntrue/config.yaml
exporters:
  - cursor # Make sure it's listed
```

**2. Validate IR schema:**

```bash
# Check rules are valid
aligntrue md lint
```

**3. Check exporter manifest:**

```bash
# List available exporters
aligntrue exporters list

# Verify cursor is in the list
```

**4. Reset to defaults:**

```yaml
# .aligntrue/config.yaml - minimal working config
mode: solo
exporters:
  - cursor
  - agents
sources:
  - type: local
    path: .aligntrue/rules
```

---

## Agents not reading rules

**Symptoms:** Cursor ignores `.mdc` updates, Copilot/Claude responses look generic, or MCP actions cannot find AlignTrue rules.

**Fix:**

1. `aligntrue status` — confirm the exporter shows `✓ detected`, the edit sources match the file you are editing, and the config path is correct.
2. `aligntrue doctor` — verify it reports the expected files (e.g., `.cursor/rules/*.mdc`, `AGENTS.md`, `.vscode/mcp.json`) as present.
3. Open the file the exporter wrote and confirm your latest rules are there. If not, re-run `aligntrue sync`.
4. Restart the agent or IDE so it reloads the file. Most IDE agents cache `AGENTS.md` or MCP configs until restart.

See the [agent verification guide](/docs/04-reference/agent-verification) for agent-specific screenshots and command references.

## Why aren't my new files syncing?

**Symptom:** You added new rule files (e.g., `testing.md`, `security.md`) to `.aligntrue/rules/` but they're not showing up in sync.

**Causes:**

1. **Files not in `.aligntrue/rules/` directory** (most common)
2. **Files have no content or sections**

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
   # Check duplicate headings in source rules
   rg "^## " .aligntrue/rules | sort | awk -F: '{print $3}' | sort | uniq -c | grep -v "^ *1 " || true
   ```

2. **Remove duplicates from source files:**

   ```bash
   nano .aligntrue/rules/global.md  # Remove or rename duplicate sections
   nano .aligntrue/rules/*.md
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
   head -20 .cursor/rules/testing.mdc
   head -20 AGENTS.md
   ```

   If you see `<!-- WARNING: READ-ONLY FILE`, edit `.aligntrue/rules/` instead.

3. **Touch file to update mtime if needed:**

   ```bash
   touch .aligntrue/rules/global.md
   aligntrue sync
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
   # Look for horizontal rules without spacing in sources
   rg "^---[^-]" .aligntrue/rules
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
   DEBUG_SYNC=true aligntrue sync
   ```

3. **Review backup:**

   ```bash
   aligntrue backup list
   ```

4. **File an issue:**
   - Repository: https://github.com/AlignTrue/aligntrue
   - Include verbose output and configuration
