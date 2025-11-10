# Settings commands

Commands for managing configuration, privacy, and system settings.

## `aligntrue config show|edit`

Display or edit AlignTrue configuration.

**Usage:**

```bash
aligntrue config show   # Display active configuration
aligntrue config edit   # Open config in default editor
```

**What it does:**

**`show` subcommand:**

- Displays active mode (solo/team/enterprise)
- Shows effective configuration with defaults
- Lists enabled modules (lockfile, bundle, checks, mcp)
- Shows exporter configuration
- Displays sync settings (auto-pull, primary agent, workflow mode)

**`edit` subcommand:**

- Opens `.aligntrue/config.yaml` in default editor
- Uses `$EDITOR` environment variable
- Falls back to `vi` on Unix, `notepad` on Windows

**Example output (show):**

```
AlignTrue Configuration
=======================

Mode: solo

Modules:
  lockfile: false
  bundle: false
  checks: true
  mcp: false

Exporters:
  - cursor
  - agents-md

Sync:
  auto_pull: true
  primary_agent: cursor
  workflow_mode: native_format

Config file: .aligntrue/config.yaml
```

**Exit codes:**

- `0` - Success
- `1` - Config file not found
- `2` - Editor failed to open (edit subcommand)

**See also:** [Team Mode Guide](/docs/03-concepts/team-mode) for configuration options

---

## `aligntrue migrate`

Schema migration tooling (pre-1.0 status).

**Usage:**

```bash
aligntrue migrate [--help]
```

**What it does:**

Displays migration policy and status. Migration tooling is not yet available in pre-1.0 releases.

**Migration framework will be added when:**

- 50+ active repositories using AlignTrue, OR
- 10+ organizations with multiple repos each, OR
- A planned breaking change significantly impacts users

**Current approach (pre-1.0):**

1. Check `CHANGELOG.md` for breaking changes
2. Follow migration guides in release notes
3. Pin CLI version if stability is critical

**Example output:**

```
⚠️  Migration tooling not yet available

AlignTrue is in pre-1.0 status (spec_version: "1").
Schema may change between releases without automated migration tooling.

Migration framework will be added when we reach:
• 50+ active repositories using AlignTrue, OR
• 10+ organizations with multiple repos, OR
• A planned breaking change that significantly impacts users

For now:
• Check CHANGELOG.md for breaking changes
• Follow migration guides for each release
• Pin CLI version if you need stability
```

**Exit codes:**

- `0` - Success (displays policy)

---

## `aligntrue telemetry on|off|status`

Control anonymous usage telemetry (opt-in only, disabled by default).

**Usage:**

```bash
aligntrue telemetry <command>
```

**Commands:**

- `on` - Enable telemetry collection
- `off` - Disable telemetry collection
- `status` - Show current telemetry status

**What we collect (when enabled):**

- Command names (`init`, `sync`, `check`, etc.)
- Export targets (`cursor`, `agents-md`, etc.)
- Rule hashes used (SHA-256, no content)
- Anonymous UUID (generated once)

**What we NEVER collect:**

- File paths or repo names
- Code or rule content
- Personal information
- Anything identifying you or your project

**Examples:**

```bash
# Check status
aligntrue telemetry status

# Enable collection
aligntrue telemetry on

# Disable collection
aligntrue telemetry off
```

**Output:**

```
Telemetry: Enabled
UUID: a3b2c1d4-e5f6-1234-5678-9abcdef01234

We collect:
  • Command names
  • Export targets
  • Rule hashes (no content)

We NEVER collect:
  • File paths or code
  • Personal information
```

**Storage:**

- State: `.aligntrue/telemetry.json`
- Events: `.aligntrue/telemetry-events.json` (last 1000 events)

---

## `aligntrue privacy audit|revoke`

Manage privacy consents for network operations.

**Usage:**

```bash
aligntrue privacy audit                    # List all consents
aligntrue privacy revoke <operation>       # Revoke specific consent
aligntrue privacy revoke --all             # Revoke all consents
```

**Commands:**

- `audit` - List all granted consents with timestamps
- `revoke git` - Revoke consent for git clones
- `revoke --all` - Revoke all consents (prompts for confirmation)

**How consent works:**

1. **First time** a network operation is needed (git source), you'll see a clear error
2. The error message explains what consent is needed and how to grant it
3. **After granting**, AlignTrue remembers and won't prompt again
4. **Revoke anytime** using `aligntrue privacy revoke`

**Examples:**

```bash
# List all consents
aligntrue privacy audit

# Revoke git consent
aligntrue privacy revoke git

# Revoke all consents with confirmation
aligntrue privacy revoke --all
```

**Audit output:**

```
Privacy Consents

  ✓ git        Granted Oct 29, 2025 at 11:45 AM

Use 'aligntrue privacy revoke <operation>' to revoke
```

**When no consents:**

```
No privacy consents granted yet

Network operations will prompt for consent when needed.
Run "aligntrue privacy audit" after granting consent to see details.
```

**Storage:**

- Consents: `.aligntrue/privacy-consent.json` (git-ignored)
- Per-machine, not committed to git
- Simple JSON format you can edit manually if needed

**Offline mode:**

The `pull` command supports `--offline` flag to use cache only without network operations. See the [pull command](/docs/04-reference/cli-reference/team#aligntrue-pull) documentation for details.

**See also:**

- [Pull command](/docs/04-reference/cli-reference/team#aligntrue-pull) - Offline mode documentation

---

## Getting help

```bash
# Show all commands
aligntrue --help

# Show command-specific help
aligntrue sync --help
```

**Exit codes summary:**

- `0` - Success
- `1` - Validation error (user-fixable)
- `2` - System error (permissions, disk space, etc.)

---

## Error codes

AlignTrue uses standardized error codes for consistent debugging and support. All errors include:

- **Clear title and message** - What went wrong
- **Actionable hints** - Next steps to fix
- **Error codes** - Reference for support

### System errors (exit code 2)

These errors indicate missing files, permissions, or system issues:

- `ERR_CONFIG_NOT_FOUND` - Configuration file missing

  ```
  ✗ Config file not found

  Could not locate: .aligntrue/config.yaml

  Hint: Run 'aligntrue init' to create initial configuration

  Error code: ERR_CONFIG_NOT_FOUND
  ```

- `ERR_RULES_NOT_FOUND` - Rules file missing

  ```
  ✗ Rules file not found

  Could not locate: .aligntrue/.rules.yaml

  Hint: Run 'aligntrue init' to create initial rules

  Error code: ERR_RULES_NOT_FOUND
  ```

- `ERR_FILE_WRITE_FAILED` - File I/O error

  ```
  ✗ File write failed

  Could not write to: .aligntrue/config.yaml

  Details:
    - Permission denied (EACCES)

  Hint: Check file permissions and disk space

  Error code: ERR_FILE_WRITE_FAILED
  ```

### Validation errors (exit code 1)

These errors indicate invalid configuration, rules, or data:

- `ERR_VALIDATION_FAILED` - Schema or rule validation failed

  ```
  ✗ Validation failed

  Errors in AGENTS.md

  Details:
    - spec_version: Missing required field
    - rules: Missing required field

  Hint: Fix the errors above and try again

  Error code: ERR_VALIDATION_FAILED
  ```

- `ERR_SYNC_FAILED` - Sync operation failed

  ```
  ✗ Sync failed

  Failed to load exporters: Handler not found

  Hint: Run 'aligntrue sync --help' for more options

  Error code: ERR_SYNC_FAILED
  ```

**See also:** [Troubleshooting Guide](/docs/05-troubleshooting) for common error solutions
