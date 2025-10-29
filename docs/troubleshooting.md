# Troubleshooting guide

Common issues and actionable solutions organized by workflow stage.

## Installation issues

### Node version mismatch

**Error:**

```
error @aligntrue/cli@0.1.0: The engine "node" is incompatible with this module.
Expected version ">=20.0.0". Got "18.16.0"
```

**Cause:** AlignTrue requires Node.js 20 or later.

**Fix:**

```bash
# Check your Node version
node --version

# Upgrade Node.js
# Using nvm (recommended)
nvm install 20
nvm use 20

# Or download from nodejs.org
# https://nodejs.org/
```

---

### pnpm not found

**Error:**

```
bash: pnpm: command not found
```

**Cause:** pnpm is not installed globally.

**Fix:**

```bash
# Install pnpm globally
npm install -g pnpm

# Verify installation
pnpm --version
```

**Alternative:** Use npx without installing:

```bash
npx @aligntrue/cli init
```

---

## Init issues

### Already initialized

**Error:**

```
⚠ This project is already initialized.

Found .aligntrue/config.yaml with mode: team
```

**Causes and fixes:**

**1. Solo mode - want to re-initialize:**

```bash
# Back up existing config
mv .aligntrue/config.yaml .aligntrue/config.yaml.bak

# Re-run init
aligntrue init

# Restore custom settings from backup if needed
```

**2. Team mode - want to join existing team project:**

```bash
# Don't run init! You're joining an existing team.
# Instead:
git pull  # Get latest rules and lockfile
aligntrue sync  # Generate agent files for your machine
```

**3. Want to switch from solo to team mode:**

```bash
aligntrue team enable
```

---

### No agents detected

**Output:**

```
◇ Detected 0 AI coding agents.
│
◆ Choose agents to enable: (Use arrow keys)
```

**Cause:** AlignTrue looks for common agent markers (`.cursor/`, `AGENTS.md`, etc.) and didn't find any.

**Fix:** Manually select agents you want to use:

1. During init, choose from the multiselect list (28 agents available)
2. Or edit `.aligntrue/config.yaml` after init:

```yaml
exporters:
  - cursor
  - agents-md
  - windsurf
  # Add more as needed
```

**Verify available agents:**

```bash
aligntrue adapters list
```

---

### Permission denied creating files

**Error:**

```
Error: EACCES: permission denied, open '.aligntrue/config.yaml'
```

**Cause:** Insufficient permissions to write to project directory.

**Fix:**

```bash
# Check directory ownership
ls -la .

# Fix ownership (Unix/macOS)
sudo chown -R $USER:$USER .

# Or run with appropriate permissions
sudo aligntrue init  # Not recommended
```

**Better approach:** Run AlignTrue as your regular user in directories you own.

---

## Sync issues

### Config not found

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

If you deleted config by accident, recreate it:

```yaml
# .aligntrue/config.yaml
mode: solo
exporters:
  - cursor
  - agents-md
sources:
  - type: local
    path: .aligntrue/rules.md
```

---

### Source file not found

**Error:**

```
✖ Source file not found: .aligntrue/rules.md

Check 'sources' in .aligntrue/config.yaml
Hint: Create rules.md or update source path
```

**Cause:** Rules file doesn't exist or path is wrong in config.

**Fix:**

**1. Create missing rules file:**

```bash
# Re-run init to create starter template
aligntrue init

# Or create minimal file manually
mkdir -p .aligntrue
echo '# My Rules' > .aligntrue/rules.md
```

**2. Fix path in config:**

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules.md  # Check this path
```

**3. Verify file exists:**

```bash
ls -la .aligntrue/rules.md
```

---

### Lockfile drift (team mode)

**Error (soft mode):**

```
⚠ Warning: Lockfile is out of sync
  Rule 'my-project.global.code-style' hash mismatch
  Expected: a3b2c1d4...
  Actual:   e5f6a7b8...

Continuing sync (soft mode)...
```

**Error (strict mode):**

```
✖ Error: Lockfile validation failed
  Rule 'my-project.global.code-style' hash mismatch
  Expected: a3b2c1d4...
  Actual:   e5f6a7b8...

Aborting sync. Fix lockfile drift or use --force.
```

**Cause:** Rules changed since lockfile was last generated.

**Fix:**

**1. Intentional changes - regenerate lockfile:**

```bash
# Update lockfile to match current rules
aligntrue sync --force

# Or in two steps:
rm .aligntrue.lock.json
aligntrue sync
```

**2. Unintentional changes - review diff:**

```bash
# Check what changed
git diff .aligntrue/rules.md

# Revert unwanted changes
git checkout .aligntrue/rules.md

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
  mode: soft    # Warn but continue (default for team mode)
  # mode: strict  # Block on mismatch (for CI)
  # mode: off     # Disable validation (solo mode)
```

---

### Exporter failures

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
  - cursor  # Make sure it's listed
```

**2. Validate IR schema:**

```bash
# Check rules are valid
aligntrue md lint
```

**3. Check exporter manifest:**

```bash
# List available exporters
aligntrue adapters list

# Verify cursor is in the list
```

**4. Reset to defaults:**

```yaml
# .aligntrue/config.yaml - minimal working config
mode: solo
exporters:
  - cursor
  - agents-md
sources:
  - type: local
    path: .aligntrue/rules.md
```

---

## Check issues (CI)

### Schema validation failures

**Error:**

```
✖ Schema validation failed:
  Line 15: Missing required field 'spec_version'
  Line 23: Invalid severity 'critical' (must be: error, warn, info)
```

**Cause:** Rules don't match JSON Schema requirements.

**Common schema mistakes:**

**1. Missing required fields:**

```yaml
# ❌ Missing fields
id: my-rule
summary: Do the thing

# ✅ All required fields
id: my-project.category.my-rule
version: "1.0.0"
spec_version: "1"
rules:
  - id: do-the-thing
    summary: Do the thing
    severity: error
```

**2. Invalid severity:**

```yaml
# ❌ Wrong values
severity: critical
severity: MUST

# ✅ Valid values
severity: error   # Must fix
severity: warn    # Should fix
severity: info    # Nice to have
```

**3. Invalid rule ID pattern:**

```yaml
# ❌ Too short or special chars
id: rule1
id: my-project/rule

# ✅ Valid format (namespace.category.name)
id: my-project.backend.use-typescript
id: acme.security.no-secrets
```

**Fix:**

```bash
# Validate locally before committing
aligntrue md lint

# Or full check
aligntrue check
```

---

### Lockfile strict mode failures

**Error (CI):**

```
✖ Lockfile validation failed in strict mode
  2 rules have hash mismatches
  
Exit code: 1
```

**Cause:** CI is using `lockfile.mode: strict` and rules changed since last lockfile update.

**Fix:**

**1. Update lockfile in your branch:**

```bash
# Regenerate lockfile
aligntrue sync --force

# Commit updated lockfile
git add .aligntrue.lock.json
git commit -m "chore: update lockfile after rule changes"
git push
```

**2. Or temporarily use soft mode in CI:**

```yaml
# .aligntrue/config.yaml
lockfile:
  mode: soft  # Warn but don't block CI
```

---

### Exit code meanings

**Exit code 0 - Success:**

All validations passed. Safe to merge.

**Exit code 1 - Validation error:**

- Schema validation failed
- Lockfile drift detected (strict mode)
- User-fixable issues

**Action:** Fix the validation errors and retry.

**Exit code 2 - System error:**

- Config file not found
- Permissions error
- Disk space issues
- Unexpected failures

**Action:** Check system logs, verify file permissions, ensure sufficient disk space.

---

## Platform-specific issues

### Windows path separators

**Issue:** Windows uses backslashes (`\`) but AlignTrue config uses forward slashes (`/`).

**Not a problem!** AlignTrue automatically normalizes paths:

```yaml
# ✅ Both work on Windows
path: .aligntrue/rules.md
path: .aligntrue\rules.md

# Internally converted to forward slashes
```

**Recommendation:** Use forward slashes in config for cross-platform compatibility.

---

### File permissions on Unix/macOS

**Error:**

```
Error: EACCES: permission denied
```

**Cause:** File or directory lacks write permissions.

**Fix:**

```bash
# Check permissions
ls -la .aligntrue/

# Fix directory permissions
chmod 755 .aligntrue/

# Fix file permissions
chmod 644 .aligntrue/config.yaml
chmod 644 .aligntrue/rules.md

# Verify ownership
ls -la .aligntrue/
# Should show your username, not root
```

**Avoid using sudo:**

```bash
# ❌ Don't do this
sudo aligntrue sync

# ✅ Do this instead
# Fix ownership first
sudo chown -R $USER:$USER .aligntrue/
# Then run without sudo
aligntrue sync
```

---

## Getting more help

### Enable verbose logging

```bash
# Set debug environment variable (coming in Phase 2)
DEBUG=aligntrue:* aligntrue sync
```

### Check versions

```bash
# CLI version
aligntrue --version

# Node version
node --version

# Package versions
cat package.json | grep aligntrue
```

### Common troubleshooting commands

```bash
# Validate everything
aligntrue check

# Lint markdown
aligntrue md lint

# Preview sync without writing
aligntrue sync --dry-run

# List enabled exporters
cat .aligntrue/config.yaml | grep exporters -A 5
```

### Still stuck?

1. Check [Command Reference](commands.md) for detailed flag documentation
2. Review [Sync Behavior](sync-behavior.md) for expected workflow
3. Open an issue at [github.com/AlignTrue/aligntrue](https://github.com/AlignTrue/aligntrue/issues)

Include in your issue:

- AlignTrue version (`aligntrue --version`)
- Node version (`node --version`)
- Operating system
- Full error message
- Steps to reproduce

