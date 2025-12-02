---
description: Systematic CLI testing playbook for AI agents
content_hash: abe35f9c42f24e1375def23fb68d390d0ddd49bbc35aeab795876a15e3a4fb2e
---

# CLI Testing Playbook

**When to apply:** Use when running systematic CLI validation before releases or when explicitly asked to test the CLI. Not for routine development or debugging.

**Goal:** Find distribution blockers and validate user workflows without maintaining a manual feature list that drifts.

**⚠️ CRITICAL WARNING: NEVER TEST IN WORKSPACE ROOT ⚠️**

**ALWAYS create test directories in `/tmp/` and work from there. Running CLI commands from the workspace root will detect existing `.aligntrue/` configuration and risk corrupting the user's actual setup. See "During testing" section for details.**

---

## Quick start

### AI-Driven Testing (Recommended)

Use these prompts to trigger automated test execution:

**Run all layers comprehensively:**

```
Execute all 9 layers from .cursor/rules/cli_testing_playbook.mdc sequentially.
```

**Run specific layer:**

```
Execute Layer 1 (Smoke Tests) from .cursor/rules/cli_testing_playbook.mdc.
```

Replace "Layer 1 (Smoke Tests)" with:

- Layer 2 (Solo Golden Paths)
- Layer 3 (Team Golden Paths)
- Layer 3.5 (Advanced Customization)
- Layer 4 (Command Coverage)
- Layer 5 (Statefulness)
- Layer 6 (Environment Matrix)
- Layer 7 (Error & UX)
- Layer 8 (Exploratory)

### Manual execution (Recommended Approach)

**Build first (required):**

```bash
cd /path/to/aligntrue
pnpm build
```

**Run all layers:**

```bash
cd packages/cli
pnpm test:comprehensive
```

This runs layers 2-8 using local workspace (fast, no network).

**Run distribution testing (Layer 1):**

```bash
cd packages/cli
pnpm test:distribution
```

Tests the packaged artifact independently.

**Run specific layer:**

```bash
cd packages/cli
pnpm test:layer 2  # Replace 2 with layer number (1-8)
```

**Generate report from logs:**

```bash
cd packages/cli
pnpm test:report .internal_docs
```

### Test Infrastructure

**Simplified Architecture (Recommended):**

- **Layer 1:** Distribution package testing via `test-distribution.sh`
  - Tests actual packaged artifact users receive
  - Independent execution
  - Run separately: `pnpm test:distribution`

- **Layers 2-8:** Feature testing via local workspace
  - Uses local build (no cloning)
  - Runs in isolated `/tmp/` directories
  - Fast feedback (seconds vs minutes)
  - Automatically protected by safety guards

**Safety Guards:**

All layer tests automatically verify:

- Current working directory is in `/tmp/` (isolated)
- Test workspace is not in workspace root
- Environment variables are properly set

If tests run from workspace root or incorrectly configured, they fail immediately with clear error messages.

**Why This Approach Works:**

1. **No dogfooding interference:** Tests use isolated `/tmp/` directories, your local AlignTrue config is untouched
2. **Fast execution:** Local builds are already cached, no cloning or rebuilding
3. **Easy debugging:** Test directories kept for inspection, clear paths
4. **Reliable:** No network dependencies, simple execution model
5. **Protected:** Explicit safety checks prevent workspace corruption

### Test results

Results are saved to:

- `.internal_docs/TEST_LOG.md` - Comprehensive test log
- Test directories in `/tmp/aligntrue-test-*/` - Keep for inspection or delete manually

---

## Core principle

**Derive specifics from the live repo each run.** Test systematically based on actual commands and docs, not a static checklist.

---

## Testing approach: Hybrid strategy for real user experience

This playbook uses a hybrid testing strategy to accurately validate user experience while maintaining fast feedback:

### Layer 1: Distribution package testing

- **Goal:** Test the actual packaged artifact users receive
- **Method:** Create tarball with `pnpm pack`, install globally with `npm install -g`
- **Why:** Catches packaging issues (missing files, wrong bin links), tests real installation flow, simulates user experience
- **Reliability:** Works with AI terminal execution (no GitHub cloning failures)

### Layers 2-8: Feature testing

- **Goal:** Validate CLI commands and workflows
- **Method:** Use local workspace directly with `pnpm exec` or PATH modifications
- **Why:** Fast, reliable, no installation overhead, tests CLI logic thoroughly
- **Scope:** All commands, statefulness, error handling, golden paths

---

## Testing resources

**Evergreen test repository:** https://github.com/AlignTrue/examples

- Stable, versioned markdown files for integration testing
- 11 curated example files live under the `aligns/` subdirectory: `aligns/global.md`, `aligns/testing.md`, `aligns/security.md`, `aligns/debugging.md`, `aligns/docs.md`, `aligns/nextjs_app_router.md`, `aligns/rule-authoring.md`, `aligns/tdd.md`, `aligns/typescript.md`, `aligns/vercel_deployments.md`, `aligns/web_quality.md`
- Use for testing git source integration, caching, and bundle merging
- Note: Files are in markdown format (`.md`), not YAML packs
- Example config:
  ```yaml
  sources:
    - type: git
      url: https://github.com/AlignTrue/examples
      path: aligns/testing.md
  ```

**Git source troubleshooting:**

- `Rules file not found` → Confirm the `path` includes `aligns/` and matches the repo file (case-sensitive).
- `git clone failed` → Ensure you granted consent: `aligntrue privacy grant git` (team CI may require this).
- Missing credentials → For private forks use SSH URLs (`git@github.com:...`) and load SSH keys in CI.
- Slow tests → Set `INTEGRATION=1` only when running network-dependent suites (see Layer 1 instructions).
- Cache cleanup → Delete `.aligntrue/.cache/git/` when changing refs or repo URLs between tests.

---

## Common False Positives

When testing the CLI, these scenarios may appear as bugs but are actually working as designed:

### Distribution Packaging

**Correct behavior:** `npm install -g` from `pnpm pack` tarball fails with workspace protocol errors

**Reality:** This is expected - `workspace:*` dependencies cannot be resolved by npm. Only `pnpm publish` auto-converts `workspace:*` to concrete versions for npm distribution.

**Reference:** See `RELEASING.md` for proper release workflow.

**Testing guidance:** Layer 1 uses a distribution simulation script that rewrites `workspace:*` to concrete versions, properly testing the distribution experience without actually publishing. Do not use `npm install -g` directly from `pnpm pack` tarball.

### pnpm link --global Limitation (Not a False Positive)

**Issue:** `pnpm link --global` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` when workspace dependencies use subpath exports.

**Root cause:** Node.js ESM loader cannot resolve `workspace:*` protocol through symlinks, even after building packages. This is a fundamental limitation of how pnpm workspace protocol interacts with global symlinks and Node.js module resolution.

**Why building doesn't fix it:**

- Building creates `dist/` directories with compiled code
- But Node.js package resolution still looks at `package.json` files which have `workspace:*` dependencies
- The ESM module resolution follows symlinks but can't resolve `workspace:*` references

**Solution for automated testing (Layers 2-8):** Use absolute path to CLI binary:

```bash
**/path/to/workspace**/packages/cli/dist/index.js command args
```

**Solution for distribution testing (Layer 1):** Use the distribution simulation script that rewrites `workspace:*` to concrete versions (see Layer 1 instructions below).

**Testing guidance:** Do NOT use `pnpm link --global` for testing. It will fail with workspace protocol errors. Always use absolute paths or the distribution simulation script.

### Plugs and Overlays Config Persistence

**False alarm:** Config-based fills/overlays not recognized after manual YAML edits

**Reality:** Manual YAML edits must match exact schema. Use CLI commands (`plugs set`, `override add`) which validate and persist correctly.

**Verification:** Check `.aligntrue/config.yaml` has correct YAML structure under `plugs.fills` or `overlays.overrides`.

### Cursor Exporter Line Counts

**False alarm:** .mdc files have fewer lines than AGENTS.md

**Reality:** Both files contain identical sections. Line differences are due to metadata footers and formatting. Compare section headings (grep "^## "), not line counts.

**Verification:** `grep "^## " AGENTS.md` vs `grep "^## " .cursor/rules/*.mdc` should match.

### Edit Source Auto-Detection

**False alarm:** Config changes to sync.edit_source not respected

**Reality:** Auto-detection runs first and may override config if agent files exist. Check detection logic priority in sync engine.

**Verification:** Use `--verbose` flag to see detection reasoning.

### Interactive vs Non-Interactive Mode Differences

**False alarm:** Init with `--yes` flag doesn't prompt for Cursor files and uses AGENTS.md instead

**Reality:** The `--yes` flag forces non-interactive mode with automatic defaults. Different from interactive mode which prompts users. Both are correct behaviors:

- **Interactive mode** (`aligntrue init` no flags): Prompts user to choose edit source, prioritizes Cursor if files exist
- **Non-interactive mode** (`aligntrue init --yes`): Auto-selects based on deterministic defaults (Cursor if exists, else AGENTS.md)

**Why this matters:** CI/automation requires non-interactive mode without prompts. Users get prompted interactively by default.

**Verification:** Compare outputs with and without `--yes` flag - both reach correct end state, just different UX.

### Backup Restoration with Agent Files

**False alarm:** Backup doesn't include agent files or restore completes without restoring AGENTS.md

**Reality:** Backup system includes agent files by default (stored in `agent-files/` subdirectory). Restoration includes all backed-up files.

**Why test might appear to fail:** Test may not check the `agent-files/` subdirectory within backup, or may not verify restoration actually copied files back.

**Verification:**

```bash
ls -la .aligntrue/.backups/TIMESTAMP/agent-files/  # Should contain backed-up files
aligntrue revert --timestamp TIMESTAMP --yes
ls -la AGENTS.md  # Should exist after restore
```

**Reference:** See `packages/core/src/backup/manager.ts` for implementation details.

### Lockfile Drift Warnings on First Team Sync

**False alarm:** Continuous "Lockfile drift detected" warnings after team init

**Reality:** First sync in team mode creates baseline lockfile. Hash migration messages appear once when upgrading from older hash algorithms. Subsequent syncs should be clean.

**Why this happens:** The lockfile stores content hashes for drift detection. When hash algorithms are improved for determinism, existing lockfiles need regeneration. The "one-time migration" message indicates this is happening.

**Verification:** Run sync twice - second sync should show no drift warnings:

```bash
aligntrue sync  # First sync: may show drift warnings
aligntrue sync  # Second sync: should show "Everything already in sync"
```

### Status File Count Display

**False alarm:** Status shows "0 .md file(s)" despite rules existing

**Reality:** This is a display bug in the status command, not a sync issue. Rules are properly loaded and exported regardless of the displayed count.

**Verification:** Check `.aligntrue/rules/` directory directly or run `aligntrue sources list`:

```bash
ls -la .aligntrue/rules/  # Shows actual files
aligntrue sources list    # Shows correct count with section details
```

### New File Detection and Auto-Enabling

**False alarm:** New agent files detected but not added to exporters

**Reality:** The auto-enabling feature works correctly. When `sync --yes` is run, detected agents are automatically added to the exporters list in config.

**Why test might appear to fail:** The tester may check config before sync completes, or may not use `--yes` flag which enables non-interactive auto-acceptance.

**Verification:**

```bash
echo "## Test" > CLAUDE.md           # Create new agent file
aligntrue sync --yes                  # Sync with auto-accept
aligntrue config get exporters        # Should include "claude"
```

### Running Commands from .aligntrue/ Directory

**False alarm:** Config lookup fails or reports path like `.aligntrue/.aligntrue/config.yaml` when running from within `.aligntrue/` directory

**Reality:** This is expected behavior. The CLI always resolves config paths relative to the current working directory (CWD).

**Why this happens:** When you `cd .aligntrue/` and run `aligntrue sync`, the CLI looks for `.aligntrue/config.yaml` relative to your CWD (which is inside `.aligntrue/`), not relative to the project root. This is by design - the CLI respects the current directory.

**How to fix:** Users should run AlignTrue commands from the project root, not from within `.aligntrue/`:

```bash
cd /path/to/project              # Correct: from project root
aligntrue sync                   # CLI finds .aligntrue/config.yaml

cd /path/to/project/.aligntrue   # Wrong: from config directory
aligntrue sync                   # CLI looks for .aligntrue/config.yaml relative to CWD
```

**This is not a bug** - it's working as designed. The CLI respects the principle of least surprise: it looks for config relative to where you run it from.

**Verification:** Always run `aligntrue` commands from your project root, not from within `.aligntrue/` or other subdirectories.

### Revert Command Preview Misconception

**False alarm:** `aligntrue revert --preview` doesn't exist or doesn't actually preview

**Reality:** The `revert` command has NO `--preview` flag. Instead, it shows a diff preview interactively before asking for confirmation. The preview is always shown (unless `--yes` skips confirmation entirely).

**Correct usage:**

```bash
# Shows interactive diff preview, then prompts for confirmation
aligntrue revert --timestamp <TIMESTAMP>

# Shows interactive diff preview, then proceeds without confirmation
aligntrue revert --timestamp <TIMESTAMP> --yes

# For specific file only (shows file diff preview)
aligntrue revert --timestamp <TIMESTAMP> <FILE>
```

**Why this matters:** The `--preview` flag does not exist. The term "preview" refers to the diff that's displayed interactively before the restore proceeds. This is automatic behavior, not a flag.

**Verification:** Run `aligntrue revert --help` to see actual flags (`--timestamp`, `--yes`, `--help`).

### Empty Rule Files Rejected

**False alarm:** Empty rule files cause validation errors

**Reality:** This is expected behavior. Empty rule files serve no purpose and are intentionally rejected. Rule files must contain content to be processed.

**Verification:** Ensure test rule files have actual markdown content, not just empty files or files with only whitespace.

### Test Isolation and Directory Reuse

**False alarm:** Filenames with dashes or underscores are rejected

**Reality:** Dashes and underscores ARE allowed in rule filenames. If filename tests fail, check that the config is valid first. Test failures are often caused by corrupted config from a previous test, not the filename itself.

**Verification:** Each exploratory test scenario should start with a clean state:

- Create a fresh test directory for each scenario
- Do not reuse directories from failed tests
- If a previous test corrupted config, start fresh: `rm -rf /tmp/aligntrue-*`

### Invalid YAML Frontmatter Detection

**False alarm:** Invalid YAML frontmatter not detected by the CLI

**Reality:** YAML parsing errors ARE detected and reported. Common test mistakes:

- `invalid: yaml: :` is actually valid YAML (nested mapping syntax)
- To test invalid YAML, use actually broken syntax like `title: [unclosed bracket` or `title: "unclosed quote`

**Verification:** Use genuine YAML syntax errors:

```bash
# WRONG - this is actually valid YAML (nested mapping)
echo 'invalid: yaml: :' > frontmatter.md

# CORRECT - these are actually invalid YAML
echo '---' > bad-frontmatter.md
echo 'title: [unclosed bracket' >> bad-frontmatter.md
echo '---' >> bad-frontmatter.md
```

### Large File Testing Methodology

**False alarm:** Large files (>200 lines) cause sync failures

**Reality:** Large markdown files work fine. Test failures are often caused by invalid test data, not file size. Using `base64` output from `/dev/urandom` creates content with characters that fail fingerprint validation (`^[a-z0-9-]+$`).

**Verification:** Use valid markdown content for large file tests:

```bash
# WRONG - binary data causes fingerprint validation errors
for i in {1..100}; do echo "$(head -c 1000 /dev/urandom | base64)" >> large.md; done

# CORRECT - valid markdown content
for i in {1..200}; do
  echo "## Section $i" >> large.md
  echo "This is valid markdown content for section $i." >> large.md
  echo "" >> large.md
done
```

---

## Critical testing principle: Understand centralized rule management

**Before testing, verify you understand:**

1. **Centralized rule management (default):**

   AlignTrue uses a **single edit source** by default:
   - ONE file or pattern is editable (e.g., `"AGENTS.md"` or `".cursor/rules/*.mdc"`)
   - All other files are **read-only exports** with warning comments
   - One-way sync: your edit source → IR → all other formats
   - Default prevents conflicts, enforces single source of truth

   **Example configuration:**

   In the current architecture, `.aligntrue/rules/*.md` is always the single source of truth. See `implementation_specs.mdc` for detailed sync behavior.

2. **Unidirectional sync:**
   - Edit files in `.aligntrue/rules/` directory
   - Run `aligntrue sync`
   - Your edits merge to `.aligntrue/rules` (IR)
   - IR exports to all configured agents (Cursor, AGENTS.md, etc.)
   - Agent files are read-only exports with warning comments
   - Result: Single source of truth, no conflicts

3. **Data flow:**
   - `.aligntrue/rules/*.md` (source) → IR (.aligntrue/rules) → exports to agents
   - All agent files are read-only and controlled by the sync system
   - Manually editing agent files will be backed up and overwritten on next sync

**Common testing mistakes:**

- Expecting agent files to sync back (they won't - they're exports)
- Editing agent files instead of `.aligntrue/rules/`
- Solution: Always edit in `.aligntrue/rules/`, not agent files

**Common testing misunderstandings:**

- **Agent file edited but didn't sync back:** Correct behavior. Agent files are read-only exports. Edit `.aligntrue/rules/` instead.

- **"Detected new agent files" prompt:** This appears when agent files with content are detected. Choose to enable them as export targets or ignore them.
  - Cursor enabled → `.cursor/rules/*.mdc`
  - Otherwise → `AGENTS.md`
  - Teams or multi-file adopters can opt into `".aligntrue/rules/*.md"` for human-friendly splits; it behaves just like other edit sources.
  - To verify: Check config or run `aligntrue config list`

4. **Experimental decentralized mode** (NOT recommended):
   - Requires `centralized: false` + array `edit_source`
   - Allows multiple editable sources with automatic merging
   - See [Experimental Features](/docs/04-reference/experimental)
   - NOT tested in standard layers (experimental only)

**Verification before testing:**
See [Choosing Your Edit Source](/docs/01-guides/00-edit-source) for detailed explanation and [Sync Behavior](/docs/03-concepts/sync-behavior) for technical details.

---

## Testing charter

Execute in order. Each layer builds on previous validation.

### 1. Smoke / Install

**What:** Test package creation and local CLI installation

**Validate:**

- Package creation succeeds (`pnpm pack`)
- Tarball contents include all necessary files
- Local installation succeeds (`pnpm link --global`)
- `aligntrue --help` returns <1s with accurate usage
- `aligntrue --version` shows correct version
- First run with no config handles gracefully
- Installed CLI is accessible from `$PATH`

**Commands:**

```bash
# Step 1: Build all workspace dependencies
cd /path/to/workspace
pnpm build  # Builds all packages (core, exporters, schema, cli, etc.)

# Step 2: Run distribution simulation script
cd packages/cli
bash tests/scripts/test-distribution.sh

# This script:
# - Creates tarball with pnpm pack
# - Extracts and rewrites workspace:* to concrete versions
# - Sets up proper NODE_PATH for testing
# - Runs smoke tests (--help, --version, init, status)
# - Reports results
# - Cleans up automatically

# OR for manual testing:

# Step 2a: Create tarball
pnpm pack  # Creates aligntrue-cli-X.Y.Z.tgz

# Step 2b: Verify tarball contents
tar -tzf aligntrue-cli-*.tgz | grep -E "dist/|package.json" | head -20

# Step 3: ⚠️ CRITICAL - Create test directory and work from there
cd /tmp
TEST_DIR="aligntrue-test-$(date +%s)"
mkdir "$TEST_DIR" && cd "$TEST_DIR"
# NOW we're in a clean test directory - safe to run CLI commands

# Step 4: Use absolute path to CLI (NOT pnpm link --global)
CLI_PATH="/path/to/workspace/packages/cli/dist/index.js"

# Verify CLI works
$CLI_PATH --version
time $CLI_PATH --help  # Should be <1s

# Test basic usage (from test directory)
$CLI_PATH check  # Should handle missing config gracefully
$CLI_PATH init --yes
$CLI_PATH status

# Cleanup
cd /path/to/workspace/packages/cli && rm -f aligntrue-cli-*.tgz
rm -rf /tmp/aligntrue-test-*
```

**Why:** This properly tests distribution without relying on `pnpm link --global`, which doesn't work with `workspace:*` dependencies. The distribution script simulates what `pnpm publish` does.

**Note:** Do NOT use `pnpm link --global` - it will fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Use absolute paths or the distribution script instead.

### 2. Golden Paths (Solo)

**What:** Core workflows a normal solo developer does

**Identify 3-5 primary workflows from:**

- `packages/cli/src/commands/*.ts` - available commands
- `apps/docs/content/` - documented workflows
- `README.md` - quickstart examples

**Validate for each workflow:**

- Exact commands match docs
- Expected outputs appear
- Resulting files are correct
- Idempotency where expected (running twice produces same result)

**Example workflows:**

- Init new project → sync to agents
- Add pack → validate → export
- Override rule → check changes
- Edit AGENTS.md → sync to agents
- Edit Cursor scope file → sync → verify round-trip to IR and other agents
- Personal rule in remote → modify → sync → verify git operations
- Ignore file management (auto-detection of format conflicts)
- Backup creation and restoration on destructive operations
- **New file detection → extract to extracted-rules.md → enable as export target**
- **Multiple new files → extract all → enable as export targets → verify extracted-rules.md**
- **Content deduplication → verify only unique content extracted**

#### Ignore file management workflow

Test automatic ignore file handling and format conflict detection:

```bash
cd /tmp/test-ignore-files
aligntrue init --mode solo --yes --exporters cursor,agents

# Verify init prompt/detection of format conflicts
# Expected: Cursor exporter should auto-manage ignore files to prevent duplicate rules

# Set manual ignore file priority (if needed)
# aligntrue config set sync.ignore_file_priority native

# Sync and verify ignore files are created/managed
aligntrue sync

# Check for auto-generated ignore files (only created when conflicts exist)
# Note: Ignore files use standard agent names (.cursorignore, .aiderignore, etc.)
# They are only created when multiple exporters target the same agent
test -f .cursorignore && echo "PASS: .cursorignore created" || echo "INFO: No conflicts detected, ignore file not needed"

# Test format priority override (optional)
aligntrue config set sync.ignore_file_priority custom
aligntrue config set sync.custom_format_priority '{"agents-md":"cursor"}'

# Sync again and verify custom priority applied
aligntrue sync

# Verify behavior: Cursor format should be preferred when custom priority set
# Note: This affects which format is used when both cursor and agents exporters are enabled
```

**Expected:**

- Auto-detection of format conflicts during init (when multiple exporters target same agent)
- Ignore files created using standard agent names (`.cursorignore`, `.aiderignore`, etc.)
- Ignore files only created when conflicts exist between exporters
- Priority settings respected during sync
- No duplicate rules across formats

#### Nested ignore file workflow

Test that ignore files are created in nested directories when rules have `nested_location`:

```bash
cd /tmp/test-nested-ignore
aligntrue init --mode solo --yes --exporters cursor,agents

# Create a rule with nested_location
mkdir -p .aligntrue/rules
cat > .aligntrue/rules/docs-rule.md <<'EOF'
---
nested_location: apps/docs
---

# Docs rule

Content for docs.
EOF

# Sync to trigger nested ignore file creation
aligntrue sync

# Verify nested ignore file was created
test -f apps/docs/.cursorignore && echo "PASS: nested ignore file created" || echo "FAIL: nested ignore file missing"

# Verify it ignores AGENTS.md (conflict between cursor and agents exporters)
grep "AGENTS.md" apps/docs/.cursorignore || echo "FAIL: AGENTS.md not ignored"
```

**Expected:**

- Nested ignore files created in directories specified by `nested_location`
- Ignore files follow same format conflict rules as root ignore files
- Multiple nested locations each get their own ignore file

#### Backup testing workflow

Test mandatory backup system and BackupManager behavior:

```bash
cd /tmp/test-backups
aligntrue init --mode solo --yes

# Verify backups directory exists
test -d .aligntrue/.backups || echo "FAIL: backups directory missing"

# Make a change that should trigger backup
echo "### New Rule" >> AGENTS.md
aligntrue sync

# Verify backup was created
ls -la .aligntrue/.backups/ | head -5
BACKUP_COUNT=$(ls .aligntrue/.backups/ | wc -l)
test $BACKUP_COUNT -gt 0 || echo "FAIL: no backups created"

# Test backup listing
aligntrue backup list

# Test restore (shows preview before confirmation)
LATEST_BACKUP=$(ls -t .aligntrue/.backups/ | head -1)
aligntrue revert --timestamp "$LATEST_BACKUP" --yes

# Verify file was restored
grep "### New Rule" AGENTS.md && echo "FAIL: restore didn't revert changes" || echo "PASS: changes reverted"

# Test retention_days configuration
aligntrue config set backup.retention_days 30
# Should succeed (age-based retention)

aligntrue config set backup.minimum_keep 3
# Should succeed (safety floor of 3 backups)

# Test that old backups are cleaned up
# Create multiple backups
for i in {1..5}; do
  aligntrue backup create --notes "Test backup $i"
  sleep 1
done

# Cleanup should respect retention_days
aligntrue backup cleanup

# Test concurrent operation uniqueness
BACKUP1=$(ls -t .aligntrue/.backups/ | head -1)
echo "First backup: $BACKUP1"
# Should contain timestamp with process ID (e.g., 20251124-123456-12345-0)
```

**Expected:**

- Backups created in `.aligntrue/.backups/TIMESTAMP-PID-SEQ/` directory
- Backup timestamps include process ID and sequence for uniqueness
- Agent files backed up to `agent-files/` subdirectory within backup
- `retention_days` configuration controls age-based cleanup (default: 30 days)
- `minimum_keep` configuration maintains safety floor of recent backups (default: 3)
- Cleanup removes backups older than `retention_days` while respecting `minimum_keep`
- Backups are mandatory for all destructive operations

#### New file detection workflow

Test automatic detection and extraction of new agent files with content:

```bash
cd /tmp/test-new-file-detection
aligntrue init --mode solo --yes

# Verify initial state
test -f AGENTS.md || echo "FAIL: AGENTS.md not created"
aligntrue config get sync.edit_source
# Expected: "AGENTS.md"

# Add new files with content (simulating copy/paste from online)
cat > CLAUDE.md <<'EOF'
## Claude-specific tips

Use clear, structured prompts.

## Code review

Review code carefully before suggesting changes.
EOF

mkdir -p .cursor/rules
cat > .cursor/rules/backend.mdc <<'EOF'
## Backend guidelines

Use async/await for all I/O operations.
EOF

# Run sync - should detect new files
aligntrue sync
# Expected prompts:
# - "Detected files with content outside your edit source"
# - Shows: CLAUDE.md (2 sections), .cursor/rules/backend.mdc (1 section)
# - Prompt: "Enable these files as export targets?"
#   Explains: existing content will be extracted to extracted-rules.md

# In automated test, use --yes flag to auto-enable
aligntrue sync --yes
# Auto-enables files as export targets

# Verify extraction occurred
test -f .aligntrue/extracted-rules.md || echo "FAIL: extracted-rules.md not created"
grep "Extracted from: CLAUDE.md" .aligntrue/extracted-rules.md || echo "FAIL: extraction missing"

# Verify files added to exporters (not edit_source)
aligntrue config get sync.edit_source
# Expected: "AGENTS.md" (unchanged - NOT updated to include new files)

aligntrue config get exporters
# Expected: ["agents", "claude", "cursor"] (new agents added)

# Verify extracted content format
grep -A 5 "Extracted from: CLAUDE.md" .aligntrue/extracted-rules.md
# Should show: date, section counts, extracted vs skipped

# Verify deduplication (if content matches IR, should be skipped)
# Add file with content that already exists in IR
cat > GEMINI.md <<'EOF'
## Security

Always use HTTPS for API calls.
EOF
# (Assuming "Security" section already exists in AGENTS.md/IR)

aligntrue sync --yes
# Should extract GEMINI.md but skip "Security" section (duplicate)

grep -A 10 "Extracted from: GEMINI.md" .aligntrue/extracted-rules.md
# Should show: Skipped: 1 (already in current rules)

# Verify files synced with current rules (overwritten)
cat CLAUDE.md
# Should contain content from AGENTS.md (current edit_source), not original content
```

**Expected:**

- New files with content detected automatically
- Interactive prompt explains extraction and overwriting
- Content extracted to `.aligntrue/extracted-rules.md` before overwriting
- Files added to exporters list (NOT to edit_source)
- Content-based deduplication skips sections already in IR
- Files overwritten with current rules from edit_source on next sync
- `extracted-rules.md` is append-only (never deleted by AlignTrue)

#### Content extraction and deduplication workflow

Test extraction of content from multiple files with overlapping sections:

```bash
cd /tmp/test-extraction-dedup
aligntrue init --mode solo --yes

# Create edit_source with initial content
cat > AGENTS.md <<'EOF'
## Security

Always validate input.

## Testing

Run tests before commit.
EOF

# Sync to establish IR
aligntrue sync

# Create new file with overlapping and unique sections
cat > CLAUDE.md <<'EOF'
## Security

Use parameterized queries to prevent SQL injection.

## Documentation

Document all public APIs.
EOF

# Sync - should detect CLAUDE.md
aligntrue sync --yes
# Expected:
# - Detects CLAUDE.md (2 sections)
# - Extracts content to extracted-rules.md
# - "Security" section should be skipped (content hash matches existing)
# - "Documentation" section should be extracted (unique)

# Verify extraction results
grep -A 10 "Extracted from: CLAUDE.md" .aligntrue/extracted-rules.md
# Should show:
# - Extracted: 1 (Documentation section)
# - Skipped: 1 (Security section - duplicate)

# Verify CLAUDE.md was overwritten with current rules
cat CLAUDE.md
# Should contain content from AGENTS.md (Security, Testing sections)
# Should NOT contain original "Documentation" section (that's in extracted-rules.md)

# Verify edit_source unchanged
aligntrue config get sync.edit_source
# Expected: "AGENTS.md" (unchanged)

# Verify exporters updated
aligntrue config get exporters
# Expected: ["agents", "claude"] (claude added)
```

**Expected:**

- Content-based deduplication skips sections already in IR
- Only unique sections extracted to extracted-rules.md
- Files overwritten with current rules from edit_source
- edit_source remains unchanged
- Exporters list updated with new agents

#### Rule import workflow

Test importing rules from external sources:

```bash
cd /tmp/test-rule-import
aligntrue init --mode solo --yes

# Test one-time import (default)
aligntrue add https://github.com/org/rules/testing.md
# Expected: Rule copied to .aligntrue/rules/testing.md with source metadata

# Verify frontmatter
grep "source:" .aligntrue/rules/testing.md || echo "FAIL: source field missing"
grep "source_added:" .aligntrue/rules/testing.md || echo "FAIL: source_added field missing"

# Test linked source
aligntrue add https://github.com/org/rules/security.md --link
# Expected: Source added to config.yaml, not copied

# Verify config
grep "security.md" .aligntrue/config.yaml || echo "FAIL: linked source not in config"

# Test conflict handling
echo "## Existing" > .aligntrue/rules/testing.md
aligntrue add https://github.com/org/rules/testing.md
# Expected: Prompt for replace/keep-both, backup if replaced

# Test init with source
cd /tmp/test-init-source
aligntrue init --source https://github.com/org/rules --yes
# Expected: Rules imported, auto-detect skipped
```

**Expected:**

- One-time import copies rules with `source` and `source_added` frontmatter
- `--link` flag adds source to config instead of copying
- Conflicts prompt for resolution with backup
- `init --source` skips auto-detection

#### Private rules workflow

Test importing rules from private (SSH) sources:

```bash
cd /tmp/test-private-rules
aligntrue init --mode solo --yes

# Test SSH source detection (requires valid SSH access)
# Use a test private repo or mock with local path + manually set private
aligntrue add git@github.com:user/private-rules
# Expected:
# - "Private source detected (SSH authentication)"
# - "Rules added to .gitignore automatically"
# - Auto-sync happens after import

# Verify gitignore was updated
grep "AlignTrue Private Rules" .gitignore || echo "FAIL: private rules section missing"
grep ".aligntrue/rules" .gitignore || echo "FAIL: source rules not in gitignore"
grep ".cursor/rules" .gitignore || echo "FAIL: exported rules not in gitignore"

# Test --no-sync flag
cd /tmp/test-private-no-sync
aligntrue init --mode solo --yes
aligntrue add git@github.com:user/private-rules --no-sync
# Expected: Rules imported but sync skipped, tip shows "run 'aligntrue sync'"

# Test linked private source
cd /tmp/test-private-linked
aligntrue init --mode solo --yes
aligntrue add git@github.com:user/private-rules --link
# Expected:
# - Source added to config with private: true
# - "Run 'aligntrue sync' to pull rules" message

# Verify config has private flag
grep "private: true" .aligntrue/config.yaml || echo "FAIL: private flag not set"

# Test per-rule privacy override (frontmatter)
cd /tmp/test-rule-privacy-override
aligntrue init --mode solo --yes
echo '---
private: true
---
# Private Rule' > .aligntrue/rules/secret.md
aligntrue sync
# Expected: Rule synced but marked for gitignore
```

**Expected:**

- SSH URLs (`git@`, `ssh://`) auto-detected as private sources
- Private source rules are auto-gitignored (both source and exports)
- Auto-sync happens after import (unless `--no-sync`)
- `--link` with SSH source sets `private: true` in config
- Frontmatter `private: true` overrides source settings
- Enhanced tips section shows privacy-aware guidance

#### File size validation workflow

Test automatic file size validation in the `check` command:

```bash
cd /tmp/test-file-size
aligntrue init --mode solo --yes

# Create a large file that exceeds the urgent threshold (1,500 lines)
for i in {1..1600}; do echo "## Section $i" >> AGENTS.md; done

# Run check command - should warn about the large file
aligntrue check 2>&1 | tee check-output.txt
grep "very large" check-output.txt || echo "FAIL: no size warning"
grep "sources split" check-output.txt || echo "FAIL: no split suggestion"

# Test sources split command
aligntrue sources split
# Expected: Splits large file into multiple smaller files

# Verify split worked
ls -la *.md | wc -l
# Expected: Multiple files created (more than 1)
```

**Expected:**

- `aligntrue check` warns about files exceeding the urgent threshold (~1,500 lines)
- The warning cites the file path, line count, and suggests `aligntrue sources split`
- `aligntrue sources split` divides large files into manageable segments
- The resulting files are smaller and more maintainable

**Note:** The `sources split` command is specifically designed for migrating from a single AGENTS.md to multi-file organization in `.aligntrue/rules/`. It does not split arbitrary large rule files. For large individual rule files in `.aligntrue/rules/`, manually split them into multiple files.

#### Sources detect workflow

Test detection of untracked agent files:

```bash
cd /tmp/test-sources-detect
aligntrue init --mode solo --yes

# Create untracked agent files
echo "## Untracked Rule" > CLAUDE.md
mkdir -p .windsurf/rules
echo "## Windsurf Rule" > .windsurf/rules/custom.md

# Detect untracked files
aligntrue sources detect
# Expected: Lists CLAUDE.md and .windsurf/rules/custom.md

# Import detected files
aligntrue sources detect --import
# Expected: Files imported to .aligntrue/rules/
```

**Expected:**

- Detects new agent files with content outside `.aligntrue/rules/`
- Lists detected files with section counts
- `--import` flag imports detected files
- Imported files added to exporters list

#### Formatting normalization workflow

Test that common formatting issues are fixed during export:

```bash
cd /tmp/test-formatting
aligntrue init --mode solo --yes

# Create file with formatting issues (horizontal rule + heading without newline)
cat > AGENTS.md <<'EOF'
## First Section

Some content here.

---### Second Section

More content.

---


### Third Section

Final content.
EOF

# Sync to export
aligntrue sync

# Verify formatting fixed in exports
cat .cursor/rules/aligntrue.mdc

# Should have proper spacing: ---\n\n###
grep -A2 "^---$" .cursor/rules/aligntrue.mdc | grep "^$" || echo "FAIL: missing newline after horizontal rule"

# Should NOT have concatenated: ---###
grep "^---#" .cursor/rules/aligntrue.mdc && echo "FAIL: found malformed horizontal rule" || echo "PASS: formatting normalized"
```

**Expected:**

- Horizontal rules followed by proper newlines
- No concatenated `---###` patterns
- All sections properly spaced
- Formatting issues fixed automatically

#### Content mode testing workflow

Test content mode configuration for single-file exports:

```bash
cd /tmp/test-content-mode
aligntrue init --mode solo --yes

# Create multiple rules to test different modes
cat > .aligntrue/rules/global.md <<'EOF'
---
description: Global rules
---

## Global Rule 1

First global rule content here.

## Global Rule 2

Second global rule content here.
EOF

cat > .aligntrue/rules/security.md <<'EOF'
---
description: Security rules
---

## Security Rule

Security rule content here.
EOF

# Test auto mode (default) - should use links for 2+ rules
aligntrue sync
grep -q "^\[" AGENTS.md && echo "PASS: auto mode uses links for 2+ rules" || echo "FAIL: links not found"

# Test inline mode - should embed all content
aligntrue sync --content-mode=inline
grep -q "<!-- aligntrue:rule" AGENTS.md && echo "PASS: inline mode uses HTML comment separators" || echo "FAIL: separators missing"

# Verify content is embedded not linked
grep -q "^\[.*Global Rule" AGENTS.md && echo "FAIL: links found in inline mode" || echo "PASS: no links in inline mode"

# Test links mode - should use markdown links
aligntrue sync --content-mode=links
grep -q "^\[.*Global Rule" AGENTS.md && echo "PASS: links mode uses markdown links" || echo "FAIL: links not found"

# Test size warning with large inline content (>50KB)
# Create rules with ~60KB of content
for i in {1..30}; do
  echo "## Rule $i" >> .aligntrue/rules/large.md
  for j in {1..100}; do
    echo "Line $j with some content to bulk up the file."  >> .aligntrue/rules/large.md
  done
done

# Sync with inline mode - should warn about size
aligntrue sync --content-mode=inline 2>&1 | tee size-warning.log
grep -i "warning.*size\|warning.*50KB\|warning.*large" size-warning.log && echo "PASS: size warning emitted" || echo "INFO: size warning not shown (file may be under 50KB)"
```

**Expected:**

- Auto mode uses inline for single rule, links for 2+ rules
- Inline mode embeds full content with HTML comment separators
- Links mode always uses markdown links to `.aligntrue/rules/` files
- Size warning emitted for inline mode with combined content >50KB
- `--content-mode` CLI flag overrides config setting
- Content modes work consistently across multiple syncs

#### MCP configuration propagation workflow

Test that MCP server configurations are correctly propagated to agent-specific files:

```bash
cd /tmp/test-mcp-propagation
aligntrue init --mode solo --yes --exporters cursor-mcp,vscode-mcp,root-mcp

# Add MCP server configuration to config
cat >> .aligntrue/config.yaml <<'EOF'
mcp:
  servers:
    - name: custom-tool
      command: python
      args: ["./tools/mcp-server.py"]
      env:
        API_KEY: "secret"
    - name: nodejs-server
      command: node
      args: ["./mcp.js"]
    - name: disabled-tool
      command: ruby
      disabled: true
EOF

# Sync to propagate MCP configs
aligntrue sync

# Verify MCP configs were written to agent-specific files
test -f .cursor/mcp.json || echo "FAIL: Cursor MCP config missing"
test -f .vscode/mcp.json || echo "FAIL: VS Code MCP config missing"
test -f .mcp.json || echo "FAIL: Root MCP config missing"

# Verify content in Cursor MCP config
grep -q "custom-tool" .cursor/mcp.json || echo "FAIL: custom-tool not in Cursor config"
grep -q "nodejs-server" .cursor/mcp.json || echo "FAIL: nodejs-server not in Cursor config"

# Verify disabled tool is NOT included
grep -q "disabled-tool" .cursor/mcp.json && echo "FAIL: disabled-tool should not be in config" || true

# Verify environment variables are included
grep -q "API_KEY" .cursor/mcp.json || echo "FAIL: environment variables not propagated"

# Verify VS Code has different format (servers vs mcpServers)
grep -q '"servers"' .vscode/mcp.json || echo "FAIL: VS Code format incorrect"
grep -q '"mcpServers"' .cursor/mcp.json || echo "FAIL: Cursor format incorrect"

# Verify root MCP has correct format
grep -q '"mcpServers"' .mcp.json || echo "FAIL: Root MCP format incorrect"

# Verify deterministic content hashes
HASH1=$(grep -o '"content_hash":"[^"]*"' .cursor/mcp.json | head -1)
HASH2=$(grep -o '"content_hash":"[^"]*"' .vscode/mcp.json | head -1)
# Both should have valid SHA256 hashes (64 hex chars)
echo "$HASH1" | grep -qE '[a-f0-9]{64}' || echo "FAIL: invalid content hash in cursor config"
echo "$HASH2" | grep -qE '[a-f0-9]{64}' || echo "FAIL: invalid content hash in vscode config"
```

**Expected:**

- MCP configs written to all configured agent-specific paths
- Server definitions propagated with correct format per agent
- Disabled servers excluded from output
- Environment variables included in output
- Content hashes present and valid (SHA256)
- VS Code gets `servers` format, Cursor/Root get `mcpServers` format

#### Edit source switch workflow

Test switching edit sources when new files replace the existing edit source:

```bash
cd /tmp/test-edit-source-switch
aligntrue init --mode solo --yes
# Default: edit_source="AGENTS.md"

# Add initial content
echo "## Initial Rule" >> AGENTS.md
aligntrue sync

# Create new Cursor rule file
mkdir -p .cursor/rules
cat > .cursor/rules/backend.mdc <<'EOF'
---
description: Backend rules
globs: "**/*.ts"
---
## Backend Rule

Use async/await.
EOF

# Switch edit source and sync – new source becomes the truth
nano .aligntrue/rules/global.md  # Edit rules directly
aligntrue sync

# Verify old source was backed up and replaced
ls -la .aligntrue/overwritten-rules/
grep "Initial Rule" .aligntrue/overwritten-rules/AGENTS.md || echo "FAIL: backup missing"
test -f AGENTS.md || echo "FAIL: AGENTS.md replaced by Cursor source"
grep "Backend Rule" .cursor/rules/backend.mdc || echo "FAIL: backend rule not synced"
```

**Expected:**

- Old edit source files are backed up to `.aligntrue/overwritten-rules/` and removed from workspace
- New edit source content replaces IR without merging
- Cursor files now reflect the current rule set
- No merge-strategy prompts or keep-both behavior

#### Nested location import and export workflow

Test that rules from nested directories are imported with `nested_location` frontmatter and exported back to the correct location:

```bash
cd /tmp/test-nested-locations
aligntrue init --mode solo --yes

# Create a nested cursor rule at apps/docs/.cursor/rules/
mkdir -p apps/docs/.cursor/rules
cat > apps/docs/.cursor/rules/web_stack.mdc <<'EOF'
---
description: Web stack guide for docs site
---

# Web stack guide

This rule is specific to the docs app.
EOF

# Run init to import the nested rule
aligntrue init --yes --exporters cursor

# Verify the imported rule has nested_location in frontmatter
cat .aligntrue/rules/web_stack.md | grep "nested_location: apps/docs" || echo "FAIL: nested_location missing"

# Sync to export back
aligntrue sync

# Verify the rule was exported to the nested location (not root)
test -f apps/docs/.cursor/rules/web_stack.mdc && echo "PASS: exported to nested location" || echo "FAIL: not exported to nested location"
```

**Expected:**

- Rules from nested directories get `nested_location` frontmatter during import
- `original_path` frontmatter preserves the source location
- Sync exports rules back to their nested locations
- Root-level rules do NOT get `nested_location` frontmatter

### 3. Golden Paths (Team)

**What:** Team mode workflows (lockfile, shared config, collaboration, personal rules)

**Validate:**

- Project init for team mode
- Config sharing between developers
- Lockfile generation and drift detection
- Personal rules (local and remote)
- Migration from solo to team mode
- Joining existing team
- Conflict behavior is clear
- No hidden global state

**Simulate:**

- Two developers (user-a, user-b) in separate working directories
- Real file operations, no mocks
- Expected: explicit conflict messages, no silent overwrites

**Key workflows to test:**

1. **Solo → Team migration:**
   - `aligntrue team enable`
   - Migration wizard for personal rules
   - Lockfile generation
   - Commit and push

2. **Joining existing team:**
   - Clone team repository
   - `aligntrue init` (detects team mode)
   - Choose personal rules option (none/local/remote)
   - `aligntrue sync`

3. **Personal remote setup:**
   - Create private git repository or use existing (e.g., AlignTrue/examples)
   - Configure remote URL in config.yaml
   - Sync personal rules from remote
   - Verify git operations (pull, merge with team rules)
   - Test with fixtures from `examples/remote-test/personal-rules.md`

4. **Team rule changes:**
   - Edit AGENTS.md (team sections)
   - `aligntrue sync`
   - Commit changes
   - PR approval workflow
   - Other team members pull and sync

5. **Personal rule changes:**
   - Edit AGENTS.md (personal sections)
   - `aligntrue sync`
   - Changes stay local or sync to personal remote
   - No team approval needed

6. **Drift detection:**
   - Make unapproved changes
   - `aligntrue drift --gates` fails in CI
   - Team lead approves via PR or `aligntrue team approve`
   - CI passes

**Test content hash-based drift detection:**

```bash
# Make unapproved changes and test hash-based detection
cd /tmp/team-user-a
echo "### Unapproved Rule" >> AGENTS.md
aligntrue drift --gates  # Should exit non-zero using content hashes

# Test reliability: copy file with different timestamp (should NOT trigger false positive)
cp AGENTS.md AGENTS-copy.md
touch -t 202501010000 AGENTS-copy.md  # Change timestamp
mv AGENTS-copy.md AGENTS.md
aligntrue drift --gates  # Should still pass (content unchanged)

# Verify uses content hash comparison, not timestamps
# This prevents intermittent CI failures and handles copy/paste workflows correctly
```

**Expected:**

- Drift detection uses content hash comparison (deterministic)
- Identical content with different timestamps does NOT trigger drift
- Cross-platform reliability (no timestamp issues)
- No false positives from file copy operations

7. **Multi-file agent editing:**
   - Edit Cursor scope files (e.g., `.cursor/rules/backend.mdc`, `.cursor/rules/frontend.mdc`)
   - Verify section routing and round-trip sync
   - Test conflict detection when same section edited in multiple files

8. **Read-only file edit detection:**

   Test the system's ability to detect and backup manual edits to read-only files before overwriting:

   **Setup:**
   - Configure `edit_source: "AGENTS.md"` (makes Cursor files read-only)
   - Run `aligntrue sync` to establish baseline

   **Test steps:**
   - Edit `.cursor/rules/aligntrue.mdc` (a read-only file)
   - Run `aligntrue sync` (without --force)
   - Verify backup created in `.aligntrue/overwritten-rules/`
   - Verify file is overwritten with clean IR content

   **Expected behavior:**
   - Backup automatically created before overwriting
   - Backup location: `.aligntrue/overwritten-rules/cursor/rules/aligntrue.{timestamp}.mdc`
   - File overwritten with IR content (manual edit removed)
   - No --force flag needed for read-only files
   - Manual edit content preserved in backup file

   **Test edit_source mode switching:**
   - Start with `edit_source: "AGENTS.md"`
   - Make edits to AGENTS.md, sync successfully
   - Change config to `edit_source: ".cursor/rules/*.mdc"`
   - Make edits to Cursor files, sync successfully
   - Verify both file types maintain their content correctly

9. **Personal rules in remote storage:**
   - Configure personal remote git repository
   - Modify personal sections and sync
   - Verify git operations (commit, push, pull)

### Team Testing Patterns

**Simulating multi-user scenarios:**

When testing team workflows locally, use separate directories to represent different developers:

```bash
# User A: Initialize team
mkdir /tmp/team-user-a && cd /tmp/team-user-a
aligntrue init --yes --mode team
aligntrue sync  # Generates lockfile

# User B: Join team (copy shared files)
mkdir /tmp/team-user-b && cd /tmp/team-user-b
cp -r /tmp/team-user-a/.aligntrue .
cp /tmp/team-user-a/AGENTS.md .
cp /tmp/team-user-a/.aligntrue.lock.json .
aligntrue init --yes  # Detects existing team setup
aligntrue sync
```

**Testing drift detection:**

```bash
# Make unapproved change (user A)
cd /tmp/team-user-a
echo "### Unapproved Rule" >> AGENTS.md
aligntrue drift --gates  # Should exit non-zero

# Approve and sync
aligntrue sync
aligntrue drift --gates  # Should pass after approval
```

This pattern exercises collaboration workflows without relying on git remotes and keeps tests deterministic.

#### Team backup and ignore file management

Test backup and ignore file behavior in team mode:

```bash
# Team user A: Enable team mode with backups
cd /tmp/team-user-a
aligntrue team enable

# Verify backups created during team transition
ls -la .aligntrue/.backups/
test -f .aligntrue/.lock.json || echo "FAIL: lockfile not created"

# Verify ignore files managed correctly in team mode
aligntrue sync
test -f .cursor/.aligntrue.ignore || echo "FAIL: ignore file missing in team mode"

# Test that all sync operations create backups
echo "### Team Rule" >> AGENTS.md
aligntrue sync

# Verify backup was created
BACKUP_COUNT=$(ls -1 .aligntrue/.backups/ | wc -l)
test $BACKUP_COUNT -gt 1 || echo "FAIL: backup not created for team sync"

# Restore from backup (interactive preview shown automatically)
LATEST_BACKUP=$(ls -t .aligntrue/.backups/ | head -1)
aligntrue revert --timestamp "$LATEST_BACKUP" --yes

# Verify restored state
grep "### Team Rule" AGENTS.md && echo "FAIL: revert didn't work" || echo "PASS: state restored"

# Team user B: Verify ignore files inherited from team
cd /tmp/team-user-b
cp -r /tmp/team-user-a/.aligntrue .
cp /tmp/team-user-a/AGENTS.md .
cp /tmp/team-user-a/.aligntrue.lock.json .

# Init detects team mode
aligntrue init --yes

# Verify ignore files are present
test -f .cursor/.aligntrue.ignore || echo "FAIL: ignore file not inherited"

# Sync should respect ignore file settings
aligntrue sync
```

**Expected:**

- Backups created during team transitions
- Ignore files properly configured in team mode
- Backups inherited when cloning team repository
- All sync operations create timestamped backups

### 3.5. Advanced Customization (Scopes, Plugs, Overlays)

**What:** Test complex monorepo and customization scenarios

**Scenario reference:** All scenarios are documented on the docs site with full configurations and explanations. Use these as reference when testing:

- Scopes: https://aligntrue.ai/docs/02-customization/scopes#scenarios
- Plugs: https://aligntrue.ai/docs/02-customization/plugs#scenarios
- Overlays: https://aligntrue.ai/docs/02-customization/overlays#scenarios

**Validate:**

- Scopes: Path-based rule application in monorepos
- Plugs: Template slot resolution with fills
- Overlays: Fork-safe pack customization
- Integration: All three features working together

**Test scenarios:**

#### Scopes workflows

**1. Monorepo with 3 scopes (frontend, backend, worker):**

```bash
cd /tmp/test-scopes-monorepo
aligntrue init --mode solo --yes

# Create monorepo structure
mkdir -p apps/web/src packages/api/src services/worker

# Create scope configuration
cat > .aligntrue/config.yaml <<EOF
mode: solo
scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-rules", "nextjs-rules"]
  - path: "packages/api"
    include: ["**/*.ts"]
    exclude: ["**/*.test.ts"]
    rulesets: ["base-rules", "node-rules"]
  - path: "services/worker"
    include: ["**/*.py"]
    rulesets: ["base-rules", "python-rules"]
merge:
  strategy: "deep"
  order: ["root", "path", "local"]
exporters:
  - agents
  - cursor
EOF

# Sync and verify
aligntrue sync
aligntrue scopes  # Should show 3 scopes with correct paths

# Verify scope-specific exports exist
test -f .cursor/rules/web.mdc || echo "FAIL: web scope export missing"
test -f .cursor/rules/api.mdc || echo "FAIL: api scope export missing"
test -f .cursor/rules/worker.mdc || echo "FAIL: worker scope export missing"
```

**Expected:**

- 3 scopes configured and listed
- Scope-specific rule exports generated
- Hierarchical merge order applied

**2. Include/exclude pattern validation:**

```bash
# Test include patterns match correctly
# Test exclude patterns filter correctly
# Verify glob pattern validation errors
```

**3. Scope conflicts and precedence:**

```bash
# Create overlapping scopes
# Verify last matching scope wins
# Test default scope (path: ".")
```

#### Plugs workflows

**Note:** Plug slots are defined in rule files (`.aligntrue/rules/*.md`) using YAML frontmatter, NOT in config.yaml. Config.yaml only stores `plugs.fills` values set via the CLI.

**1. Slot declaration and fill resolution:**

```bash
cd /tmp/test-plugs
aligntrue init --mode solo --yes

# Create a rule file with plug slots in YAML frontmatter
cat > .aligntrue/rules/testing.md <<'EOF'
---
description: Testing guidelines with configurable commands
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
      required: true
      example: "pytest -q"
    docs.url:
      description: "Documentation URL"
      format: url
      required: false
      example: "https://docs.example.com"
---

# Testing Guidelines

Run tests with: [[plug:test.cmd]]

Documentation: [[plug:docs.url]]
EOF

# List plugs (should show unresolved required)
aligntrue plugs list
# Should show: test.cmd (required, unresolved), docs.url (optional)

# Set fill for required plug via CLI (saves to config.yaml under plugs.fills)
aligntrue plugs set test.cmd "pnpm test"
# Should validate format and update config.yaml

# Verify fill was set
aligntrue plugs list
# Should show: test.cmd filled (from config), docs.url optional

# Test unset command
aligntrue plugs unset test.cmd
aligntrue plugs list
# Should show: test.cmd unresolved again

# Set it back
aligntrue plugs set test.cmd "pnpm test"

# Test format validation
aligntrue plugs set test.cmd "/absolute/path" || echo "Expected: validation error"
aligntrue plugs set docs.url "not-a-url" || echo "Expected: validation error"
aligntrue plugs set docs.url "https://docs.example.com"  # Should succeed

# Resolve and verify
aligntrue plugs resolve
# Should show: test.cmd resolved to "pnpm test", docs.url resolved to URL

# Sync and check output
aligntrue sync
grep "Run tests with: pnpm test" AGENTS.md || echo "FAIL: plug not resolved"
```

**Expected:**

- Slots defined in rule file frontmatter are detected
- Fills stored in config.yaml under `plugs.fills`
- Unresolved required plugs detected
- Fill validation works (format checking)
- Optional plugs resolve to empty string
- Required plugs generate TODO blocks if unresolved

**2. Format validation:**

```bash
# Test command format
aligntrue plugs set test.cmd "pnpm test"  # Valid
aligntrue plugs set test.cmd "/absolute/path"  # Should fail

# Test file format
aligntrue plugs set config.file "config/settings.json"  # Valid
aligntrue plugs set config.file "../secrets.json"  # Should fail (parent traversal)

# Test URL format
aligntrue plugs set docs.url "https://docs.example.com"  # Valid
aligntrue plugs set docs.url "example.com"  # Should fail (missing protocol)
```

**3. Unresolved required plugs generate TODO blocks:**

```bash
# Sync without filling required plug
# Verify TODO block appears in output
grep "TODO(plug:test.cmd):" AGENTS.md || echo "FAIL: TODO block missing"
```

**4. Config-based fills:**

Test plugs configuration via config.yaml and fill precedence:

```bash
cd /tmp/test-plugs-config
aligntrue init --mode solo --yes

# Create a rule file with plug slots in YAML frontmatter
cat > .aligntrue/rules/testing.md <<'EOF'
---
description: Testing guidelines with configurable values
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
      required: true
    docs.url:
      description: "Documentation URL"
      format: url
      required: false
    author.name:
      description: "Author name"
      format: text
      required: false
---

# Testing Guidelines

Run tests with: [[plug:test.cmd]]

Documentation: [[plug:docs.url]]

Author: [[plug:author.name]]
EOF

# Set fills via CLI
aligntrue plugs set test.cmd "pnpm test"
aligntrue plugs set docs.url "https://docs.example.com"
aligntrue plugs set author.name "Jane Smith"

# Verify fills in config.yaml
grep -A 5 "plugs:" .aligntrue/config.yaml | grep -q "test.cmd" || echo "FAIL: fills not in config"

# List plugs and verify source (should show "from config")
aligntrue plugs list
# Expected: All three slots filled with values from config

# Resolve plugs
aligntrue plugs resolve
# Expected: All slots resolved to their fill values

# Sync and verify fills are applied
aligntrue sync

# Check output has filled values
grep "Run tests with: pnpm test" AGENTS.md || echo "FAIL: test.cmd not filled"
grep "Documentation: https://docs.example.com" AGENTS.md || echo "FAIL: docs.url not filled"
grep "Author: Jane Smith" AGENTS.md || echo "FAIL: author.name not filled"

# Test unsetting a fill
aligntrue plugs unset author.name

# Verify it was removed
grep "author.name" .aligntrue/config.yaml && echo "FAIL: unset didn't remove fill" || echo "PASS: fill removed"

# Verify plugs list shows unset slot as unresolved
aligntrue plugs list | grep -q "author.name" || echo "FAIL: unset slot not shown"

# Test invalid format values
aligntrue plugs set test.cmd "/absolute/path" 2>&1 | grep -i "error" || echo "FAIL: should reject absolute path"
aligntrue plugs set docs.url "not-a-url" 2>&1 | grep -i "error" || echo "FAIL: should reject invalid URL"
aligntrue plugs set docs.url "ftp://invalid" 2>&1 | grep -i "error" || echo "FAIL: should reject non-https URL"
```

**Expected:**

- Fills stored in config.yaml under `plugs.fills`
- Config fills take precedence over IR fills
- Format validation works for all types (command, file, url, text)
- Invalid formats rejected with clear error messages
- `plugs set <slot> <value>` updates config
- `plugs unset <slot>` removes config fill
- `plugs list` shows fill source (config vs IR)

#### Overlays workflows

**1. Override severity (warning → error):**

```bash
cd /tmp/test-overlays
aligntrue init --mode solo --yes

# Create base pack
cat > upstream-pack.yaml <<EOF
id: upstream-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: "No console.log"
    content: "Avoid console.log in production"
    level: 2
    fingerprint: "no-console-log"
    severity: "warning"
EOF

# Configure with overlay
cat > .aligntrue/config.yaml <<EOF
mode: solo
sources:
  - type: local
    path: upstream-pack.yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
exporters:
  - agents
EOF

# Sync and verify overlay applied
aligntrue sync
aligntrue override status  # Should show 1 active overlay

# Check output has upgraded severity
# (Implementation detail: verify in exported files)
```

**2. Add check inputs (complexity threshold):**

```bash
# Override with nested property
aligntrue override add \
  --selector 'rule[id=max-complexity]' \
  --set check.inputs.threshold=15

aligntrue override status  # Should show override
```

**3. Remove autofix:**

```bash
# Remove property from rule
aligntrue override add \
  --selector 'rule[id=prefer-const]' \
  --remove autofix

aligntrue override diff  # Should show autofix removed
```

**4. Multiple overlays and health checking:**

```bash
# Add multiple overlays
# Run aligntrue override status
# Verify all show as "healthy"

# Simulate upstream change (rename rule ID)
# Run aligntrue override status
# Should show stale overlay warning
```

#### Combined scenarios

**1. Monorepo with scopes + plugs + overlays:**

```bash
cd /tmp/test-combined
aligntrue init --mode solo --yes

# Configure all three features
cat > .aligntrue/config.yaml <<EOF
mode: solo
scopes:
  - path: "apps/web"
    rulesets: ["nextjs-rules"]
  - path: "packages/api"
    rulesets: ["node-rules"]
plugs:
  fills:
    test.cmd: "pnpm test"
    docs.url: "https://docs.example.com"
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
exporters:
  - agents
  - cursor
EOF

# Sync and verify all features work together
aligntrue sync

# Verify:
# 1. Scopes applied (different rules per directory)
# 2. Plugs resolved (test.cmd filled)
# 3. Overlays applied (severity upgraded)
```

**2. Scope-specific plug fills:**

```bash
# Test that plugs can have different values per scope
# Verify hierarchical merge order applies to plugs
```

**3. End-to-end determinism:**

```bash
# Run sync twice
# Verify byte-identical outputs
# Check content hashes match
```

**Validation checklist:**

- [ ] `aligntrue scopes` lists configured scopes correctly
- [ ] `aligntrue plugs list` shows slots and fills
- [ ] `aligntrue plugs resolve` previews resolution
- [ ] `aligntrue override status` shows overlay health
- [ ] `aligntrue override diff` shows changes
- [ ] Combined features work without conflicts
- [ ] Deterministic outputs (run sync twice, compare hashes)

#### Multi-source merge scenarios

**1. First-wins precedence:**

Test that local rules always override external sources:

```bash
cd /tmp/test-multi-source
mkdir -p .aligntrue/rules

# Local rule
cat > .aligntrue/rules/security.md <<'EOF'
## No Console

Use console.log carefully (local version).
EOF

# Config with external source (would normally override in old system)
cat > .aligntrue/config.yaml <<'EOF'
mode: solo
exporters:
  - agents
EOF

# Sync and verify local rule is used
aligntrue sync

# Expected: local rule content appears, not external
grep "local version" AGENTS.md || echo "FAIL: local rule not used"
```

**2. Source ordering in output:**

Verify sync shows source precedence summary:

```bash
cd /tmp/test-multi-source

# Config with multiple sources
cat > .aligntrue/config.yaml <<'EOF'
mode: solo
sources:
  - type: git
    include:
      - https://github.com/test/repo
exporters:
  - agents
EOF

# Sync shows source precedence
aligntrue sync 2>&1 | tee sync.log

# Verify summary output
grep "Sources.*priority" sync.log || echo "FAIL: no source summary"
grep ".aligntrue/rules.*local" sync.log || echo "FAIL: local not listed first"
```

**3. Include array syntax validation:**

Test new `include` syntax accepts multiple URLs per source:

```bash
cd /tmp/test-multi-source

# Valid include array
cat > .aligntrue/config.yaml <<'EOF'
mode: solo
sources:
  - type: git
    include:
      - https://github.com/company/rules
      - https://github.com/company/rules@v2.0.0/packs
      - https://github.com/other/rules/security.md
exporters:
  - agents
EOF

# Config should be valid
aligntrue check || echo "FAIL: config validation failed"
```

**4. URL parsing with ref and path:**

Test URL parsing for `https://github.com/org/repo@ref/path` format:

```bash
cd /tmp/test-multi-source

# Config with full URL format
cat > .aligntrue/config.yaml <<'EOF'
mode: solo
sources:
  - type: git
    include:
      - https://github.com/company/rules                    # All .md in root
      - https://github.com/company/rules/packs              # All .md in directory
      - https://github.com/company/rules@v2.0.0             # Specific version
      - https://github.com/company/rules@v2.0.0/security.md # Version + file
exporters:
  - agents
EOF

# Should validate without errors
aligntrue check || echo "FAIL: URL parsing validation failed"
```

**5. Add and remove sources workflow:**

Test adding then removing a source works cleanly:

```bash
mkdir -p /tmp/test-add-remove/.aligntrue/rules

cd /tmp/test-add-remove

# Initial config
cat > .aligntrue/config.yaml <<'EOF'
mode: solo
exporters:
  - agents
EOF

echo "## Base" > .aligntrue/rules/base.md

# Check initial status
aligntrue status | grep "base.md" || echo "FAIL: base rule not found"

# Add external source
cat > .aligntrue/config.yaml <<'EOF'
mode: solo
sources:
  - type: git
    url: https://github.com/test/repo
    path: test.md
exporters:
  - agents
EOF

# Verify config is valid
aligntrue check || echo "FAIL: config with source is invalid"

# Remove the source
cat > .aligntrue/config.yaml <<'EOF'
mode: solo
exporters:
  - agents
EOF

# Verify config is still valid
aligntrue check || echo "FAIL: config after removing source is invalid"
```

**6. Conflict detection with first-wins:**

Verify conflicts are reported showing which source wins:

```bash
# Expected output shows:
# - Rule exists in multiple sources
# - Which source wins (highest priority)
# - Why (precedence explanation)
```

### 4. Command Coverage

**What:** Systematic breadth across all commands

**For each command:**

- Happy path with valid inputs
- Required flags missing (should error clearly)
- Invalid input (should error with fix suggestion)
- Conflicting flags (should error or warn)
- `--help` exists and matches actual behavior

**Validate exit codes:**

- 0 on success
- Non-zero with clear message on failure

**Key commands to test (ensure coverage):**

**Organization & multi-file:**

- `sources list` - List all source files with section counts
- `sources split` - Split AGENTS.md into multiple files

**Privacy & consent:**

- `privacy audit` - List all consents with timestamps
- `privacy grant <operation>` - Grant consent for operations (e.g., git)
- `privacy revoke <operation>` - Revoke specific or all consents

**Onboarding & migration:**

- `onboard` - Generate developer onboarding checklist
- `migrate personal` - Migrate to personal mode
- `migrate team` - Migrate to team mode
- `migrate ruler` - Migrate from Ruler format

**Backup & recovery:**

- `revert --timestamp <timestamp>` - Restore specific backup (shows diff preview automatically)
- `revert --timestamp <timestamp> --yes` - Restore without confirmation prompt

**Configuration management:**

- `config show` - Display active configuration with mode
- `config edit` - Open config in editor
- `config summary` - Concise configuration summary
- `config get <key>` - Get single value (dot notation)
- `config set <key> <value>` - Set value with validation
- `config list` - List all key-value pairs
- `config unset <key>` - Remove optional config value

**Exporter management:**

- `exporters detect` - Detect new agents in workspace
- `exporters ignore <name>` - Ignore detected agent

**Flag usage reference:**

Common flags and supported commands:

- `--force`, `--force-invalid-ir`, `--force-refresh`, `--dry-run` — `sync` only
- `--yes`, `-y`, `--non-interactive` — `init`, `migrate`, `revert`
- `--ci` — `check` only
- `--gates` — `drift` only

Tip: Run `aligntrue <command> --help` for full flag details.

**Plugin contract validation:**

Note: The `ExporterPlugin` interface in `@aligntrue/plugin-contracts` includes an optional `resetState()` method:

- Allows exporters to clear internal state (like warning counters) between sync runs
- Fully backward compatible (optional method)
- Used to prevent state leakage across multiple sync operations
- Not directly testable via CLI, but important for plugin developers

**Coverage expectations:**

85% coverage (22/26 commands) is acceptable for comprehensive testing. The 4 untested commands require special setup or are destructive:

- `backup cleanup` - Would delete actual backups
- `plugs set/unset/resolve` - Requires plug definitions in rules
- `exporters detect/enable/disable` - Requires specific agent files present
- `migrate personal/team/ruler` - Requires schema changes to exist
- `link` - Requires git remote setup
- `sources split` - Requires large AGENTS.md file
- `telemetry on/off` - Changes telemetry state

These commands are covered by dedicated integration tests. When updating commands, verify related integration tests exist in `packages/cli/tests/`.

### 5. Statefulness

**What:** Real-world persistence and state management scenarios

**Test with:**

- No config (first run)
- Valid config
- Corrupted config (malformed YAML)
- Partial state (cache exists but config missing)
- Backup recovery from various states

**Validate:**

- State is stored in documented locations (.aligntrue/, .aligntrue.lock.json, .aligntrue/.backups/)
- Cache invalidation works correctly
- Backup system maintains file integrity
- Restore operations recover proper state
- **Drift log persists across sessions**
- **Watch mode state with new file detections**

#### Watch mode new file detection

Test that watch mode detects new files and logs them without auto-importing:

```bash
cd /tmp/test-watch-new-files
aligntrue init --mode solo --yes

# Start watch in background
aligntrue watch > watch.log 2>&1 &
WATCH_PID=$!

# Wait for watch to initialize
sleep 2

# Add new file while watch is running
cat > CLAUDE.md <<'EOF'
## New rule

This was added while watch was running.
EOF

# Wait for detection
sleep 2

# Check watch output
grep "New file detected: CLAUDE.md" watch.log || echo "FAIL: watch didn't detect new file"
grep "Run 'aligntrue sync' to review and enable" watch.log || echo "FAIL: missing user guidance"

# Verify drift log created
test -f .aligntrue/.drift-log.json || echo "FAIL: drift log not created"
cat .aligntrue/.drift-log.json
# Should contain CLAUDE.md with status: "pending_review"

# Stop watch
kill $WATCH_PID

# Run sync interactively (would prompt in real usage)
aligntrue sync --yes

# Verify file enabled as export target
aligntrue config get exporters
# Should include "claude"

# Verify extraction occurred
test -f .aligntrue/extracted-rules.md || echo "FAIL: extraction missing"
grep "Extracted from: CLAUDE.md" .aligntrue/extracted-rules.md || echo "FAIL: extraction not logged"

# Verify edit_source unchanged
aligntrue config get sync.edit_source
# Should be "AGENTS.md" (unchanged, NOT updated to include CLAUDE.md)
```

### Testing drift log creation

To verify drift log persistence:

1. Start watch mode: `aligntrue watch`
2. In another terminal, create a new agent file: `echo "# Test" > CLAUDE.md`
3. Watch mode should log: "New file detected: CLAUDE.md"
4. Verify drift log exists: `ls -la .aligntrue/.drift-log.json`
5. Stop and restart watch - log should persist

# Verify drift log structure

cat .aligntrue/.drift-log.json | jq '.'

# Should contain: file paths, timestamps, detection status, content hashes

# Test that content hashes are used (not just timestamps)

# This aligns with improved deduplication logic

1. Start watch mode: `aligntrue watch`
2. In another terminal, create a new agent file: `echo "# Test" > CLAUDE.md`
3. Watch mode should log: "New file detected: CLAUDE.md"
4. Verify drift log exists: `ls -la .aligntrue/.drift-log.json`
5. Stop and restart watch - log should persist

**Expected:**

- Watch detects new files in real-time
- Logs detection with helpful message
- Writes to drift log with "pending_review" status
- Does NOT auto-enable (safe default)
- Next sync shows pending detections
- After enabling, content extracted to extracted-rules.md
- Files added to exporters (not edit_source)

#### Drift log persistence

Test that drift log persists across sessions and sync operations:

```bash
cd /tmp/test-drift-persistence
aligntrue init --mode solo --yes

# Add untracked files
echo "## Rule 1" > FILE1.md
echo "## Rule 2" > FILE2.md
echo "## Rule 3" > FILE3.md

# Run sync once - should detect all three
aligntrue sync --yes

# Verify drift log created
test -f .aligntrue/.drift-log.json || echo "FAIL: drift log missing"
DETECTION_COUNT=$(cat .aligntrue/.drift-log.json | grep -c '"file"')
test $DETECTION_COUNT -eq 3 || echo "FAIL: expected 3 detections, got $DETECTION_COUNT"

# Exit and restart (simulating session end/start)
cd /
cd /tmp/test-drift-persistence

# Drift log should still exist
test -f .aligntrue/.drift-log.json || echo "FAIL: drift log not persisted"

# Run sync again - should remember previous state
aligntrue sync --yes

# Verify detections updated (not duplicated)
DETECTION_COUNT=$(cat .aligntrue/.drift-log.json | grep -c '"file"')
test $DETECTION_COUNT -eq 3 || echo "FAIL: detections duplicated, got $DETECTION_COUNT"

# Verify timestamps updated
cat .aligntrue/.drift-log.json | grep "timestamp"
```

**Expected:**

- Drift log persists across sessions
- File system state preserved in `.aligntrue/.drift-log.json`
- No duplication of detections on subsequent syncs
- Timestamps update correctly

### 6. Environment Matrix

**What:** Cross-platform and runtime validation

**Reason about behavior on:**

- macOS, Linux, Windows
- Different shells (bash, zsh, fish, cmd, powershell)
- Node versions (20 LTS, 22, latest)
- CI environments (GitHub Actions, local scripts)

**Node.js support:**

- Minimum: Node 20 LTS (supported until April 2026)
- Recommended: Node 20 or 22
- CI validates both Node 20 and Node 22 compatibility

**Validate:**

- Commands are scriptable and deterministic
- Paths use correct separators
- No platform-specific assumptions leak

### 7. Error & UX

**What:** User trust via helpful errors and predictable behavior

**Validate:**

- Error messages state what failed, why, and how to fix
- Exit codes follow conventions (0=ok, 1=validation, 2=user error, 3=system error)
- Progress indicators only for operations >10s
- No sensitive data in logs
- Deterministic outputs (same inputs → same outputs)

### 8. Exploratory

**What:** Find unknown unknowns after structured coverage

**Behave as:**

- A clever user who skimmed the docs
- Goal: break the CLI or find confusing behavior using only supported commands

**Propose 10-15 strange but plausible sequences:**

- Rapid mode switches (solo → team → solo)
- Conflicting config changes
- Partial file deletions mid-operation
- Race conditions (two terminals, same repo)
- Edge cases from real usage patterns

**Document:**

- What bug or confusion you are probing for
- Actual behavior vs expected behavior
- Severity (blocks adoption vs polish)

---

## Execution protocol

### Before testing

**0. Validate understanding:**

- Read `.cursor/rules/architecture.mdc` section on sync behavior
- Confirm understanding of edit_source, multi-file sync, and team mode
- If uncertain, ask before proceeding with tests

**1. Scan the repo:**

- `packages/cli/src/commands/*.ts` - list all commands
- `packages/cli/README.md` - document CLI usage
- `apps/docs/content/getting-started/` - quickstart flows
- `CHANGELOG.md` - recent changes that need validation

**2. Build command inventory in scratchpad:**

Run `aligntrue --help` and scan `packages/cli/src/commands/*.ts` to build complete current inventory.

**Quick command count:**

```bash
# Count dispatch statements in packages/cli/src/index.ts
# Current count: 24 commands (verified from packages/cli/src/commands/index.ts)
# Includes top-level commands and subcommands for comprehensive coverage
```

**Current commands (25+ total, with 40+ subcommands):**

```
Core commands:
- aligntrue init [--mode solo|team] [--force] [--source <url>] [--link] [--exporters <list>] [--yes]
- aligntrue sync [--dry-run] [--force] [--verbose]
- aligntrue watch [--debounce <ms>]
- aligntrue check [--ci]

Rule management:
- aligntrue add <source> [--link] [--ref <ref>] [--path <path>]
- aligntrue remove <rule-file>
- aligntrue rules

Team mode:
- aligntrue team <enable|disable|status> [options]
- aligntrue drift [--gates] [--format human|json|sarif]
- aligntrue link <url> [--method <submodule|subtree|shallow-clone>]

Customization:
- aligntrue override <add|status|diff|remove> [options]
- aligntrue plugs <list|resolve|validate|set|unset> [options]
- aligntrue scopes

Organization:
- aligntrue sources <list|split|detect> [options]

Configuration:
- aligntrue config <show|edit|summary|get|set|list|unset> [options]
- aligntrue exporters <list|enable|disable|detect|ignore> [options]

Backup & Recovery:
- aligntrue backup <create|list|restore|cleanup> [options]
- aligntrue revert [--timestamp <timestamp>] [--yes]

Utilities:
- aligntrue telemetry <on|off|status>
- aligntrue privacy <audit|grant|revoke> [options]
- aligntrue onboard [--ci <path>]
- aligntrue migrate [preview|apply]
- aligntrue status
- aligntrue doctor
```

**Verification:**
Always cross-check with `aligntrue --help` output and `packages/cli/src/commands/index.ts` exports to ensure completeness.

Use your derived inventory as ground truth for test design.

**3. Check last test log:**

- Read `.internal_docs/TEST_LOG.md` if exists
- Identify gaps and untested areas
- Plan this session to complement previous runs

### During testing

**CRITICAL: Testing Only, No Fixes**

**⚠️ ABSOLUTE REQUIREMENT: NEVER TEST IN REPO ROOT ⚠️**

**NEVER run test commands from the workspace root directory (`/path/to/aligntrue` or any path containing `.aligntrue/`).**

**ALWAYS:**

- Create isolated test directories in `/tmp/` (e.g., `/tmp/aligntrue-test-{timestamp}`)
- Change directory INTO the test directory BEFORE running any CLI commands
- Use absolute paths to the CLI binary if needed: `/path/to/workspace/packages/cli/dist/index.js`
- OR use `pnpm link --global` first, then run `aligntrue` from the test directory

**WHY:** The repo root contains the user's actual AlignTrue configuration. Running `init`, `sync`, or other commands there will:

- Detect existing `.aligntrue/` directory and exit early
- Potentially corrupt or modify the user's real configuration
- Make validation impossible to test
- Risk data loss or configuration damage

**Example CORRECT workflow:**

```bash
# ✅ CORRECT: Create test dir and work from there
cd /tmp
TEST_DIR="aligntrue-test-$(date +%s)"
mkdir "$TEST_DIR" && cd "$TEST_DIR"
# Now run CLI commands here, not from repo root
/path/to/workspace/packages/cli/dist/index.js init --yes
```

**Example WRONG workflow:**

```bash
# ❌ WRONG: Running from repo root
cd /path/to/workspace
node packages/cli/dist/index.js init  # NO! This will detect existing .aligntrue/
```

**Safety Guards (Automatic):**

All test layers now include automatic safety checks:

```typescript
// Every layer starts with:
assertTestSafety();

// This verifies:
// 1. Current directory is in /tmp/ (isolated)
// 2. TEST_WORKSPACE env var points to isolated directory
// 3. ALIGNTRUE_CLI env var points to correct binary
// 4. LOG_FILE env var is set for output
```

If these checks fail, tests immediately exit with a clear error message explaining the problem.

**Why This Protects Your Setup:**

- Tests cannot accidentally run in workspace root
- Your dogfooding configuration is never touched
- Failures are explicit (not silent corruption)
- Same protection applies whether tests run manually or via automation

**AI must NOT:**

- Modify any source code files (except test files created in the hermetic test environment)
- Attempt to fix bugs or issues discovered during testing
- Make changes to the main workspace or repository
- Implement recommendations or solutions
- **Run any CLI commands from the workspace root directory**

**AI must ONLY:**

- Execute test commands in the hermetic test environment (`/tmp/aligntrue-test-{timestamp}`)
- **ALWAYS change directory into the test directory before running CLI commands**
- Capture outputs, exit codes, and execution times
- Document findings with severity (P0-P3)
- Provide actionable recommendations for the user to review
- Report all issues in `.internal_docs/TEST_LOG.md`

**All fixes and code changes are the user's responsibility.** The AI's role is to discover and document issues, not to resolve them.

---

**Work in hermetic sandbox:** AI must create test directories for Layer 1 package testing, execute tests, capture outputs, and clean up automatically.

**Create test environment:**

```bash
# For Layer 1 (distribution package testing)
# Build and pack from workspace (this is safe - just creates a file)
cd /path/to/workspace/packages/cli
pnpm pack  # Creates aligntrue-cli-X.Y.Z.tgz in current directory

# ⚠️ CRITICAL: Create test directory OUTSIDE workspace and work from there
cd /tmp
TEST_DIR="aligntrue-test-$(date +%s)"
mkdir "$TEST_DIR" && cd "$TEST_DIR"
# NOW we're in a clean test directory, safe to run CLI commands

# Install from tarball (or use pnpm link --global)
npm install -g /path/to/workspace/packages/cli/aligntrue-cli-*.tgz
export TZ=UTC
export NODE_ENV=test
node --version
npm --version
which aligntrue
```

**For Layers 2-8 (feature testing):**

**⚠️ CRITICAL: Still create test directories in /tmp, never run from workspace root**

```bash
# Create isolated test directory
cd /tmp
TEST_DIR="aligntrue-test-$(date +%s)"
mkdir "$TEST_DIR" && cd "$TEST_DIR"
# NOW we're in a clean test directory

# Use CLI from workspace (absolute path) OR use pnpm link --global
export TZ=UTC
export NODE_ENV=test
node --version
pnpm --version

# Option 1: Use absolute path to CLI
/path/to/workspace/packages/cli/dist/index.js init --yes

# Option 2: NOT RECOMMENDED - pnpm link --global does not work
# DO NOT USE pnpm link --global - it fails with ERR_PACKAGE_PATH_NOT_EXPORTED
# due to workspace:* protocol incompatibility with symlinks
```

**Why this approach:**

- Layer 1 tests the actual packaged artifact users receive, catching packaging issues (missing files, wrong bin links)
- Tests real global installation experience via `npm install -g`, not monorepo `pnpm` commands
- Layers 2-8 use local workspace for fast feature validation without installation overhead
- Works reliably with AI terminal execution (no GitHub cloning failures)

**Execute charter layers 1-8 in order.**

**⚠️ REMINDER: Every test command must run from a test directory in /tmp, NEVER from workspace root.**

**Record findings as you go:**

- Command that failed
- Expected vs actual behavior
- Severity (P0=blocks adoption, P1=major friction, P2=polish, P3=nice-to-have)
- Root cause if identifiable

---

### AI Execution Checklist

When running automated tests, the AI must complete all steps:

**Setup:**

- [ ] **CRITICAL: Create test directory in /tmp and change into it BEFORE any CLI commands**
- [ ] For Layer 1: Build all workspace packages with `cd /path/to/workspace && pnpm build`
- [ ] For Layer 1: Create tarball with `cd packages/cli && pnpm pack` (safe - just creates file)
- [ ] For Layer 1: Run distribution simulation script: `cd packages/cli && bash tests/scripts/test-distribution.sh`
- [ ] For Layers 2-8: Build workspace packages first, then use absolute path to CLI (NEVER use `pnpm link --global`)
- [ ] **NEVER run CLI commands from workspace root directory**
- [ ] Set environment variables: `TZ=UTC` and `NODE_ENV=test`
- [ ] Verify Node and npm/pnpm versions
- [ ] For Layer 1: Verify `which aligntrue` shows global install path

**Execution:**

- [ ] Run each test command from the layer definition
- [ ] Capture stdout and stderr for all commands
- [ ] Record exit codes (0=success, non-zero=failure)
- [ ] Measure execution time for performance-sensitive commands
- [ ] Take snapshots of file system state before and after operations
- [ ] Save all outputs to log file for analysis

**Analysis:**

- [ ] Compare actual vs expected outputs for each test
- [ ] Identify error patterns and failure modes
- [ ] Assign severity to each issue (P0=blocker, P1=major, P2=polish, P3=nice-to-have)
- [ ] Determine root cause when identifiable
- [ ] Note any platform-specific behaviors
- [ ] Flag non-deterministic outputs

**Reporting:**

- [ ] Write findings to `.internal_docs/TEST_LOG.md`
- [ ] Include all commands run with their outputs
- [ ] List all issues found with severity and root causes
- [ ] Document gaps for next test run
- [ ] Provide actionable recommendations
- [ ] Include performance metrics where relevant

**Cleanup:**

- [ ] Remove test directory: `rm -rf /tmp/aligntrue-test-{timestamp}`
- [ ] Remove package tarballs: `rm -f packages/cli/aligntrue-cli-*.tgz`
- [ ] Verify no artifacts left in workspace
- [ ] Confirm no background processes running
- [ ] Automatic cleanup runs before and after tests (keeps last 3 runs or 24 hours)

**Cleanup Policy:**

Test artifacts are automatically cleaned up:

- **Test directories:** `/tmp/aligntrue-test-*` (keep last 3 runs OR directories newer than 24 hours)
- **Package tarballs:** `packages/cli/aligntrue-cli-*.tgz` (removed after each Layer 1 test)
- **Runs automatically:** Before and after comprehensive test runs
- **Manual cleanup:**
  - Test directories: `find /tmp -maxdepth 1 -name "aligntrue-test-*" -mtime +1 -exec rm -rf {} \;`
  - Package tarballs: `find packages/cli -name "aligntrue-cli-*.tgz" -exec rm {} \;`

---

### Automated output analysis

**Exit Code Validation:**

Capture and validate exit codes for every command:

```bash
# Pattern for capturing exit codes
aligntrue sync
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAIL: Expected 0, got $EXIT_CODE"
  echo "Command: aligntrue sync"
  echo "Stderr: $(cat stderr.log)"
fi
```

**Expected exit codes:**

- 0: Success
- 1: Validation error
- 2: User input error
- 3: System error

**Output Pattern Matching:**

Look for these indicators in command output:

**Success indicators:**

- "✓" or "✔"
- "Success"
- "completed"
- "done"

**Error indicators:**

- "Error:"
- "Failed:"
- "✗" or "✘"
- Non-zero exit code

**Warning indicators:**

- "Warning:"
- "⚠"
- "Note:"

**File Validation:**

Verify expected files exist and contain correct content:

```bash
# Check file existence
test -f .aligntrue/config.yaml || echo "FAIL: config.yaml missing"
test -d .aligntrue/rules || echo "FAIL: rules directory missing"
test -f AGENTS.md || echo "FAIL: AGENTS.md missing"

# Check directory structure
test -d .cursor/rules || echo "FAIL: .cursor/rules directory missing"
```

**Content Validation:**

```bash
# Verify file contents contain expected patterns
grep -q "profile:" .aligntrue/config.yaml || echo "FAIL: profile field missing in config"
grep -q "sections:" .aligntrue/rules || echo "FAIL: sections missing in IR"

# Verify JSON structure
jq -e '.version' .aligntrue.lock.json || echo "FAIL: lockfile missing version"
```

**Large Rule Set Testing:**

Test CLI performance with realistic large rule sets:

**Note:** The `examples/remote-test/large-rules/` directory contains markdown files with YAML frontmatter. These are proper markdown sources (not pure YAML IR files) and should be used as `type: local` sources in config.

```bash
# Copy large rule fixtures (markdown files with YAML frontmatter)
cp -r examples/remote-test/large-rules /tmp/test-project/rules

# Configure all files as sources
cat > .aligntrue/config.yaml <<EOF
mode: solo
sources:
  - type: local
    path: rules/backend-api.md
  - type: local
    path: rules/frontend-react.md
  - type: local
    path: rules/database.md
  - type: local
    path: rules/testing-integration.md
  - type: local
    path: rules/security-auth.md
  - type: local
    path: rules/devops-ci.md
  - type: local
    path: rules/code-review.md
  - type: local
    path: rules/documentation.md
  - type: local
    path: rules/performance.md
  - type: local
    path: rules/accessibility.md
exporters:
  - agents
  - cursor
EOF

# Measure sync time
time aligntrue sync

# Expected: <60 seconds for 80-100 sections (10 files × 8-10 sections each)
# Expected: <500MB memory usage
# Expected: All files processed successfully
# Expected: AGENTS.md and .cursor/rules/*.mdc contain merged content from all sources
```

**Performance Validation:**

```bash
# Time command execution
START=$(date +%s%N)
aligntrue --help
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))  # Convert to milliseconds

if [ $DURATION -gt 1000 ]; then
  echo "FAIL: --help took ${DURATION}ms (expected <1000ms)"
fi

# Performance thresholds for large rule sets
# - Init: <10 seconds
# - Sync (100-150 sections): <60 seconds (first run), <30 seconds (subsequent)
# - Help: <5 seconds
# - Memory: <500MB heap for large rule sets
```

**Determinism Validation:**

```bash
# Run command twice and compare outputs
aligntrue sync --dry-run > output1.txt 2>&1
aligntrue sync --dry-run > output2.txt 2>&1

if ! diff -q output1.txt output2.txt; then
  echo "FAIL: Non-deterministic output detected"
  diff -u output1.txt output2.txt
fi
```

**Log Analysis:**

Parse logs for common issues:

- Sensitive data exposure (tokens, keys, passwords)
- Stack traces in user-facing output
- Unclear error messages
- Missing "how to fix" guidance
- Inconsistent formatting

---

### After testing

**Log results to `.internal_docs/TEST_LOG.md`:**

Append entry:

```markdown
## Test run YYYY-MM-DD

**Commit:** abc123def
**Scope:** Solo workflows, command coverage
**Duration:** ~45 minutes

**Scenarios Executed:**

- ✅ Smoke tests (install, help, version)
- ✅ Solo golden paths (init → sync → export)
- ⚠️ Command coverage (3/15 commands tested)
- ❌ Team workflows (deferred)

**Notable Findings:**

- P1: `aligntrue check` exits 0 on validation errors (should be non-zero)
- P2: `aligntrue override add` unclear error when pack not found
- P3: Help text for `--force` flag inconsistent across commands

**Gaps for Next Run:**

- Complete command coverage (12 commands remaining)
- Team mode simulation (lockfile workflows)
- Environment matrix (test on Linux CI)

**Files Created:**

- (none, logs only)
```

**Format:**

- Date, commit hash, scope, duration
- Checklist of charter layers executed
- Findings with severity
- Gaps to test next time

**Do NOT fabricate results.** If you cannot run commands, describe what SHOULD be tested instead.

---

## Kick-Off Prompts

Use these to invoke AI-driven test execution. Each prompt triggers actual command execution in a hermetic environment.

### Layer 1: Smoke Tests

```
Execute Layer 1 (Smoke Tests) from .cursor/rules/cli_testing_playbook.mdc.

EXECUTION PROTOCOL:
1. Set up hermetic test environment in /tmp/aligntrue-test-{timestamp}
2. Build all workspace packages: cd /path/to/workspace && pnpm build
3. Run distribution simulation script: cd packages/cli && bash tests/scripts/test-distribution.sh
4. Set environment: TZ=UTC, NODE_ENV=test
5. Execute smoke test scenarios:
   - Distribution script verification (package creation, tarball contents)
   - CLI binary execution with absolute path
   - aligntrue --help (must return <1s)
   - aligntrue --version
   - First run with no config
6. Capture all outputs, exit codes, and execution times
7. Validate against expected behavior
8. Report findings with severity (P0-P3)
9. Clean up test environment

OUTPUT: Structured report in .internal_docs/TEST_LOG.md format with:
- Commands executed
- Pass/fail status
- Issues found with root causes
- Performance metrics
```

### Layer 2: Solo Golden Paths

```
Execute Layer 2 (Solo Golden Paths) from .cursor/rules/cli_testing_playbook.mdc.

EXECUTION PROTOCOL:
1. Set up hermetic test environment in /tmp/aligntrue-test-{timestamp}
2. Build command inventory from packages/cli/src/commands/
3. Execute core solo workflows:
   - Init new project → sync to agents
   - Edit AGENTS.md → sync → verify round-trip
   - Edit Cursor scope file → sync → verify IR update
   - Override rule → check changes
   - Add pack → validate → export
4. Execute new feature workflows:
   - Ignore file management (auto-detection of format conflicts)
   - Backup creation and restoration on destructive operations
   - Config-based plugs fills (set/unset/validate formats)
5. For each workflow:
   - Run exact commands
   - Capture stdout, stderr, exit codes
   - Verify resulting files (config, IR, exports)
   - Test idempotency (run twice, compare outputs)
6. Validate against expected behavior from docs
7. Report findings with severity
8. Clean up test environment

OUTPUT: Structured report with workflow results and issues found.
```

### Layer 3: Team Golden Paths

```
Execute Layer 3 (Team Golden Paths) from .cursor/rules/cli_testing_playbook.mdc.

EXECUTION PROTOCOL:
1. Set up two hermetic test environments: user-a and user-b in /tmp
2. Execute team workflows:
   - Solo → team migration (user-a)
   - Personal remote setup (user-a)
   - Joining existing team (user-b)
   - Team rule changes with PR workflow
   - Personal rule changes (no approval)
   - Drift detection and resolution
   - Multi-file agent editing
   - Read-only file edit detection
3. Execute team-specific new features:
   - Backup creation and restoration in team mode
   - Ignore file management in team transitions
   - Backup inheritance when cloning team repository
4. For each workflow:
   - Run exact commands in sequence
   - Capture all outputs
   - Verify lockfile generation
   - Test conflict detection
   - Validate git operations
   - Verify backup directory structure and restore functionality
5. Report findings with severity
6. Clean up both test environments

OUTPUT: Structured report with team workflow results and collaboration issues.
```

### Layer 4: Command Coverage

```
Execute Layer 4 (Command Coverage) from .cursor/rules/cli_testing_playbook.mdc.

EXECUTION PROTOCOL:
1. Set up hermetic test environment in /tmp
2. Build complete command inventory from packages/cli/src/commands/
3. For each of 27 commands (40+ subcommands):
   - Execute happy path with valid inputs
   - Test with missing required flags
   - Test with invalid inputs
   - Test with conflicting flags
   - Verify --help exists and is accurate
   - Validate exit codes (0=success, non-zero=failure)
4. Specific focus on new commands:
   - aligntrue status: Verify output shows exporters, sync health, mode
   - aligntrue doctor: Run health checks, verify diagnostics
   - aligntrue onboard: Generate checklist, test --ci flag with SARIF input
   - aligntrue plugs set/unset: Test format validation and fill management
   - aligntrue backup cleanup: Test cleanup command and keep_count enforcement
5. Capture all outputs and error messages
6. Validate error messages include what/why/how
7. Report findings with severity
8. Clean up test environment

OUTPUT: Command coverage matrix with pass/fail status and issues per command.
```

### Layer 5: Statefulness

```
Execute Layer 5 (Statefulness) from .cursor/rules/cli_testing_playbook.mdc.

EXECUTION PROTOCOL:
1. Set up hermetic test environment in /tmp
2. Test state scenarios:
   - No config (first run)
   - Valid config
   - Corrupted config (malformed YAML)
   - Partial state (cache exists, config missing)
3. For each scenario:
   - Run commands and capture behavior
   - Verify error handling
   - Test state recovery
   - Validate cache invalidation
4. Test backup system state management:
   - Verify .aligntrue/.backups/ directory structure
   - Validate keep_count configuration enforcement
   - Test backup restoration from various states
   - Verify backup cleanup respects retention policy
   - Confirm concurrent operations use unique timestamps
5. Verify state stored in documented locations
6. Report findings with severity
7. Clean up test environment

OUTPUT: State management report with scenarios tested and issues found.
```

### Layer 6: Environment Matrix

```
Execute Layer 6 (Environment Matrix) from .cursor/rules/cli_testing_playbook.mdc.

EXECUTION PROTOCOL:
1. Identify current platform (macOS/Linux/Windows)
2. Set up hermetic test environment in /tmp
3. Test environment variations:
   - Current shell (bash/zsh/fish/cmd/powershell)
   - Node versions (20, 22, latest)
   - Different path separators
   - CI environment simulation
4. Execute core workflows on current platform
5. Validate:
   - Commands are scriptable
   - Outputs are deterministic
   - Paths use correct separators
   - No platform-specific assumptions
6. Report platform-specific issues
7. Clean up test environment

OUTPUT: Environment compatibility report with platform-specific findings.
```

### Layer 7: Error & UX

```
Execute Layer 7 (Error & UX) from .cursor/rules/cli_testing_playbook.mdc.

EXECUTION PROTOCOL:
1. Set up hermetic test environment in /tmp
2. Test error scenarios:
   - Invalid commands
   - Missing required arguments
   - File not found errors
   - Permission errors
   - Network failures (if applicable)
   - Validation errors
3. For each error:
   - Capture error message
   - Verify exit code follows conventions
   - Validate message includes what/why/how
   - Check for sensitive data in logs
4. Test UX elements:
   - Progress indicators (operations >10s)
   - Deterministic outputs (same inputs → same outputs)
   - Help text accuracy
5. Report findings with severity
6. Clean up test environment

OUTPUT: Error/UX report with message quality assessment and issues found.
```

### Layer 8: Exploratory

```
Execute Layer 8 (Exploratory) from .cursor/rules/cli_testing_playbook.mdc.

EXECUTION PROTOCOL:
1. Set up hermetic test environment in /tmp
2. Design 10-15 strange but plausible sequences:
   - Rapid mode switches (solo → team → solo)
   - Conflicting config changes
   - Partial file deletions mid-operation
   - Race conditions (two terminals, same repo)
   - Edge cases from real usage patterns
3. For each sequence:
   - State what bug/confusion you are probing
   - Execute the commands
   - Capture actual behavior
   - Compare against expected behavior
   - Assign severity if issue found
4. Report all unexpected behaviors
5. Clean up test environment

OUTPUT: Exploratory findings report with edge cases discovered and severity.
```

### All layers: Comprehensive run

```
Execute all layers from .cursor/rules/cli_testing_playbook.mdc sequentially.

EXECUTION PROTOCOL:
1. Set up hermetic test environment in /tmp
2. Execute layers 1-8 in order
3. Aggregate results across all layers
4. Generate comprehensive report in .internal_docs/TEST_LOG.md
5. Provide summary with:
   - Total scenarios executed
   - Issues found by severity (P0-P3)
   - Coverage percentage
   - Gaps for next run
6. Clean up test environment

OUTPUT: Comprehensive test report with full findings and recommendations.
```

---

## Steer vs Wander

**When to steer (structured):**

- Before releases
- After major refactors
- When validating new features
- When fixing regressions

Use charter layers 1-7 systematically.

**When to wander (exploratory):**

- After structured coverage is complete
- When hunting for edge cases
- When simulating creative user behavior

Use charter layer 8 to find unknowns.

**Never:**

- Pure wandering without charter guidance (misses boring vital stuff)
- Pure checklist execution without adaptation (tests rot)

**Balance:**
Rules define structure. AI derives specifics from live repo. Log what's tested for incremental coverage.

---

## Success criteria

**Tests are effective when:**

- Real blockers found before users hit them
- Gaps explicitly documented for next run
- Findings include severity and root cause
- Test log shows incremental coverage over time

**Tests are ineffective when:**

- AI clusters around obvious paths only
- Same scenarios repeated without learning
- Findings are vague ("seems slow") without data
- No logging of what was validated

---

## Related rules

- `testing.mdc` - Test decision framework and TDD workflow
- `debugging.mdc` - Systematic debugging when tests reveal issues
