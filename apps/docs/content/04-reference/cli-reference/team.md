# Team mode commands

Commands for managing team mode features (hidden until team mode enabled).

## `aligntrue drift`

Detect drift between lockfile and current state. Team mode uses the lockfile bundle hash as the single drift signal.

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

- **lockfile** - Rules/config changed since last lockfile generation

**Exit codes:** `0` (no drift), `2` (drift with --gates)

**See:** [Drift detection guide](/docs/03-concepts/drift-detection)

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
aligntrue onboard

# Include CI check results
aligntrue onboard --ci checks.sarif

# Use custom config
aligntrue onboard --config custom-config.yaml
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

**Exit codes:** `0` (success), `1` (error)

**See:** [Onboarding guide](/docs/04-reference/cli-reference/onboard)

---

## `aligntrue team enable`

Upgrade project to team mode with lockfile enabled.

**Usage:**

```bash
aligntrue team enable
```

**What it does:**

1. Creates `.aligntrue/config.team.yaml` with team settings
2. Enables lockfile module automatically
3. Moves team-only settings from `config.yaml` to `config.team.yaml`
4. Creates an empty personal `config.yaml` for individual settings (added to `.gitignore`)
5. Shows next steps for lockfile generation

**Interactive prompts:**

- **Confirm team mode** - Explains lockfile and bundle features
- **Idempotent** - Safe to run multiple times (can be re-enabled after `team disable`)

**Configuration files after enable:**

| File                   | Purpose                         | Git status |
| ---------------------- | ------------------------------- | ---------- |
| `config.team.yaml`     | Team settings (mode, lockfile)  | Committed  |
| `config.yaml`          | Personal settings (overrides)   | Gitignored |
| `.aligntrue/lock.json` | Lockfile (generated after sync) | Committed  |

**Examples:**

```bash
# Enable team mode
aligntrue team enable

# Then generate lockfile
aligntrue sync  # Auto-generates .aligntrue/lock.json
```

**Exit codes:**

- `0` - Success (or already in team mode)
- `2` - System error (file write failed)

**What changes:**

Before (solo mode):

```yaml
# .aligntrue/config.yaml
mode: solo
modules:
  lockfile: false
  bundle: false
sources:
  - type: local
    path: rules
exporters:
  - cursor
```

After (team mode):

```yaml
# .aligntrue/config.team.yaml (committed)
mode: team
modules:
  lockfile: true
sources:
  - type: local
    path: rules
exporters:
  - cursor
# .aligntrue/config.yaml (gitignored, created for personal settings)
# Add your personal settings here
# Examples: personal remotes, local overrides
```

**Personal vs team settings:**

- **Team settings** (in `config.team.yaml`): `mode`, `modules.lockfile`, shared `sources`, shared `exporters`
- **Personal settings** (in `config.yaml`): Personal remotes, local overrides of shared settings

**See also:** [Team Mode Guide](/docs/01-guides/02-team-guide), [Sync Behavior](/docs/03-concepts/sync-behavior#lockfile-behavior-team-mode)

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
