# Team mode commands

Commands for managing team mode features (hidden until team mode enabled).

## `aligntrue drift`

Detect drift between lockfile and approved sources. Monitors upstream changes, vendored pack integrity, and policy compliance.

**Usage:**

```bash
aligntrue drift [options]
```

**Options:**

- `--gates` - Exit non-zero if drift detected (CI mode)
- `--json` - Output results in JSON format
- `--sarif` - Output results in SARIF format for CI tools
- `--config <path>` - Custom config file path

**Examples:**

```bash
# Check for drift
aligntrue drift

# CI mode (fail on drift)
aligntrue drift --gates

# JSON output
aligntrue drift --json
```

**Drift categories:**

- **upstream** - Rule content differs from allowed version
- **vendorized** - Vendored pack differs from source
- **severity_remap** - Policy changes

**Exit codes:** `0` (no drift), `2` (drift with --gates)

**See:** [Drift detection guide](/docs/03-concepts/drift-detection)

---

## `aligntrue update`

Check for and apply updates from approved sources. Generates UPDATE_NOTES.md with change summary.

**Usage:**

```bash
aligntrue update <check|apply> [options]
```

**Subcommands:**

- `check` - Preview available updates
- `apply` - Apply updates and generate UPDATE_NOTES.md

**Options:**

- `--config <path>` - Custom config file path
- `--dry-run` - Preview without applying (apply only)

**Examples:**

```bash
# Check for updates
aligntrue update check

# Apply updates
aligntrue update apply

# Preview what would be applied
aligntrue update apply --dry-run
```

**Update workflow:**

1. Detects updates by comparing lockfile to allow list
2. Generates UPDATE_NOTES.md with change summary
3. Runs `aligntrue sync --force` automatically
4. Updates lockfile with new hashes

**Update summary includes:**

- Number of sources updated
- Affected rules per source
- Breaking changes (if any)
- Previous and current commit SHAs

**Exit codes:** `0` (success), `1` (validation error), `2` (system error)

**Requirements:** Team mode enabled

**See:** [Auto-updates guide](/docs/04-reference/auto-updates)

---

## `aligntrue onboard`

Generate personalized developer onboarding checklist based on recent work, check results, and project state.

**Usage:**

```bash
aligntrue onboard [options]
```

**Options:**

- `--ci <path>` - Path to SARIF file with CI check results
- `--config <path>` - Custom config file path

**Examples:**

```bash
# Basic onboarding checklist
aln onboard

# Include CI check results
aln onboard --ci checks.sarif

# Use custom config
aln onboard --config custom-config.yaml
```

**Checklist includes:**

- Recent commit history and file changes
- Uncommitted changes warnings
- Test file patterns (suggest running tests)
- Source changes without tests (warning)
- Documentation updates
- Team drift (in team mode)
- Unresolved required plugs
- Failed checks (when --ci provided)

**Integrations:**

- **Drift detection** - Shows team drift in team mode
- **Check results** - Parses SARIF from CI runs
- **Plugs** - Detects unresolved required plugs automatically

**Output format:**

```
🚀 Developer Onboarding Checklist

Based on your recent work:
  Last commit: feat: Add feature
  By: Developer Name
  Files changed: 5

Actionable next steps:

1. ⚠️ Run tests (2 test files modified)
   → Run: pnpm test

2. ℹ️ Run validation checks
   → Run: aligntrue check
```

**Exit codes:** `0` (success)

**See:** [Onboarding guide](/docs/06-contributing/team-onboarding)

---

## `aligntrue team enable`

Upgrade project to team mode with lockfile validation.

**Usage:**

```bash
aligntrue team enable
```

**What it does:**

1. Updates `.aligntrue/config.yaml` to set `mode: team`
2. Enables lockfile and bundle modules automatically
3. Shows next steps for lockfile generation

**Interactive prompts:**

- **Confirm team mode** - Explains lockfile and bundle features
- **Idempotent** - Safe to run multiple times

**Examples:**

```bash
# Enable team mode
aligntrue team enable

# Then generate lockfile
aligntrue sync  # Auto-generates .aligntrue.lock.json
```

**Exit codes:**

- `0` - Success (or already in team mode)
- `2` - System error (file write failed)

**What changes:**

Before (solo mode):

```yaml
mode: solo
modules:
  lockfile: false
  bundle: false
```

After (team mode):

```yaml
mode: team
modules:
  lockfile: true
  bundle: true
lockfile:
  mode: soft # Warn on drift, don't block
```

**See also:** [Sync Behavior](/docs/03-concepts/sync-behavior#lockfile-behavior-team-mode) for lockfile modes.

---

## `aligntrue scopes`

List and discover scopes in your workspace.

**Usage:**

```bash
aligntrue scopes [subcommand] [options]
```

**Subcommands:**

| Subcommand | Description                                    |
| ---------- | ---------------------------------------------- |
| (none)     | List configured scopes                         |
| `discover` | Auto-discover nested `.aligntrue/` directories |

**Flags:**

| Flag          | Description                                | Default |
| ------------- | ------------------------------------------ | ------- |
| `--yes`, `-y` | Skip confirmation prompts (for `discover`) | `false` |

**What it shows (list mode):**

- Scope paths
- Include/exclude patterns
- Configured rulesets

**What it does (discover mode):**

1. Searches for nested `.aligntrue/` directories
2. Shows discovered directories with rule status
3. Optionally adds them as scopes to config

**Examples:**

```bash
# List all scopes
aligntrue scopes

# Discover nested scopes
aligntrue scopes discover

# Discover and add without prompts
aligntrue scopes discover --yes
```

**Output:**

```
Configured scopes (2):

1. apps/web
   Include: ["**/*.ts", "**/*.tsx"]
   Exclude: ["**/*.test.ts"]
   Rulesets: ["nextjs-rules"]

2. packages/core
   Include: ["**/*.ts"]
   Exclude: []
   Rulesets: ["core-standards"]
```

**Exit codes:**

- `0` - Success
- `2` - Config not found

---

## `aligntrue link`

Vendor rule packs from git repositories using git submodules or subtrees.

**Usage:**

```bash
aligntrue link <git-url> [--path <vendor-path>]
```

**What it does:**

1. Detects existing submodule/subtree vendoring at specified path
2. Validates pack integrity (`.aligntrue.yaml` required at repo root)
3. Updates config with vendor metadata (path and type)
4. Provides workflow guidance for updates and collaboration

**Does NOT execute git operations** - You must vendor manually first using git submodule or subtree.

**Key concept:** Link registers vendored packs so AlignTrue can track their provenance for drift detection. Vendoring provides:

- **Offline access** - Rules available without network
- **Version control** - Vendored code tracked in your repo
- **Security auditing** - Review all vendored code before use
- **Team collaboration** - Clear ownership and update workflows

**Options:**

- `--path <vendor-path>` - Custom vendor location (default: `vendor/<repo-name>`)
- `--config, -c <path>` - Custom config file path

**Examples:**

```bash
# Submodule workflow
git submodule add https://github.com/org/rules vendor/org-rules
aligntrue link https://github.com/org/rules --path vendor/org-rules

# Subtree workflow
git subtree add --prefix vendor/org-rules https://github.com/org/rules main --squash
aligntrue link https://github.com/org/rules --path vendor/org-rules

# Default vendor path
git submodule add https://github.com/org/rules vendor/rules
aligntrue link https://github.com/org/rules
```

**Vendor type detection:**

AlignTrue automatically detects:

- **Submodule** - `.git` file with `gitdir:` reference
- **Subtree** - `.git` directory (full git repo)

**Team mode integration:**

In team mode, link warns if source is not in allow list:

```
⚠️  Not in allow list

This source is not in your team's allow list.
To approve this source:
  aligntrue team approve "https://github.com/org/rules"

This is non-blocking but recommended for team workflows.
```

Approve before or after linking - both work.

**Output example:**

```
✅ Successfully linked https://github.com/org/rules

Vendor path: vendor/org-rules
Vendor type: submodule
Profile: org/typescript-rules

Next steps:
1. Commit vendor changes: git add vendor/org-rules .aligntrue/config.yaml
2. Run sync: aligntrue sync
3. Update lockfile (if team mode): git add .aligntrue.lock.json
```

**Update workflows:**

**Submodule:**

```bash
cd vendor/org-rules
git pull origin main
cd ../..
git add vendor/org-rules
git commit -m "chore: Update vendored rules"
```

**Subtree:**

```bash
git subtree pull --prefix vendor/org-rules https://github.com/org/rules main --squash
```

**Common use cases:**

**When to vendor vs config:**

Use `aligntrue link` (vendoring) for:

- Production dependencies (offline access required)
- Security-critical rules (audit before use)
- Stable versions (infrequent updates)
- Team review of rule changes in PRs

Use config-based git sources for:

- Quick setup and adoption
- Automatic updates on sync
- Simpler workflow without git submodules/subtrees
- Most common use cases

**Submodule vs Subtree:**

| Aspect     | Submodule                         | Subtree               |
| ---------- | --------------------------------- | --------------------- |
| Complexity | Requires `git submodule` commands | Just `git pull`       |
| Space      | More efficient (reference only)   | Full copy in repo     |
| Team setup | `git submodule init && update`    | No extra steps        |
| History    | Separate                          | Merged with main repo |
| Updates    | `git submodule update`            | `git subtree pull`    |

**Recommendation:** Subtrees for simplicity, submodules for space efficiency.

**Exit codes:**

- `0` - Success
- `1` - Validation error (invalid URL, duplicate vendor, pack validation failed)
- `2` - System error (git operations, file system errors)

**Troubleshooting:**

**Error: "Vendor already exists"**

Remove existing vendor first:

```bash
# For submodule
git rm -rf vendor/org-rules
rm -rf .git/modules/vendor/org-rules
git commit -m "chore: Remove old vendor"

# For subtree
git rm -rf vendor/org-rules
git commit -m "chore: Remove old vendor"

# Then re-link
git submodule add https://github.com/org/rules vendor/org-rules
aligntrue link https://github.com/org/rules --path vendor/org-rules
```

**Error: "Pack validation failed"**

Ensure vendored repo has valid `.aligntrue.yaml` at root:

```bash
# Check pack file exists
ls vendor/org-rules/.aligntrue.yaml

# Validate pack manually
cat vendor/org-rules/.aligntrue.yaml
```

Required fields: `id`, `version`, `spec_version`, `profile.id`

**See also:**

- [Git Workflows Guide - Vendoring](/docs/03-concepts/git-workflows#vendoring-workflows) - Complete vendoring workflows
- [Team Mode Guide](/docs/03-concepts/team-mode) - Team approval workflows
