# Drift detection

Drift detection helps teams monitor alignment between their lockfile and approved rule sources. It identifies when rules have changed upstream, when vendored packs differ from their sources, or when severity remapping policies have been modified.

## Overview

Drift detection compares your lockfile's rule hashes against:

- **Allowed sources** - Approved versions in `.aligntrue/allow.yaml`
- **Vendored packs** - Integrity of git submodule/subtree vendored rules
- **Severity remapping** - Policy changes in `.aligntrue.team.yaml`

**Key benefits:**

- Catch upstream rule changes before they cause issues
- Verify vendored pack integrity
- Monitor policy compliance
- CI/CD integration with `--gates` flag

## Drift categories

### Upstream drift

**What it detects:** Rule content in lockfile differs from the approved version in allow list.

**Common causes:**

- Upstream pack updated to new version
- Local modifications to rules
- Allow list not updated after rule changes

**How to fix:**

```bash
# Review the changes
aligntrue drift

# Approve new version
aligntrue team approve <source>@<new-version>

# Or accept current state
aligntrue sync --force
```

### Vendorized drift

**What it detects:** Vendored pack (git submodule/subtree) differs from source or is missing.

**Common causes:**

- Vendored pack deleted or moved
- Pack updated without re-linking
- Missing `.aligntrue.yaml` in vendored path

**How to fix:**

```bash
# Update vendored pack
cd vendor/pack-name
git pull
cd ../..

# Re-sync
aligntrue sync
```

### Severity remap drift

**What it will detect:** Changes to `.aligntrue.team.yaml` severity remapping rules.

**Common causes:**

- Policy downgrade without rationale
- Remapping rules modified

## Usage

### Basic drift check

```bash
# Show drift (human-readable)
aligntrue drift

# Output:
# Drift Detection Report
# ======================
#
# UPSTREAM DRIFT (1 items):
#   • base-global: Lockfile hash differs from allowed version
#     Suggestion: Run: aligntrue team approve git:...
```

### CI integration

```bash
# Exit non-zero if drift detected
aligntrue drift --gates

# Exit codes:
# 0 = No drift detected
# 2 = Drift detected (only with --gates)
```

### JSON output

```bash
# Machine-readable output
aligntrue drift --json

# Output:
# {
#   "driftDetected": true,
#   "mode": "team",
#   "lockfilePath": ".aligntrue.lock.json",
#   "summary": "2 drift findings across 2 categories",
#   "driftByCategory": {
#     "upstream": [...],
#     "vendorized": [...]
#   }
# }
```

### SARIF output

```bash
# For GitHub/GitLab CI integration
aligntrue drift --sarif > drift-report.sarif

# Upload to GitHub code scanning
# (GitHub Actions example in CI workflows section)
```

## CI workflows

### GitHub Actions

```yaml
name: Drift Detection

on:
  schedule:
    - cron: "0 0 * * *" # Daily at midnight
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm install -g @aligntrue/cli

      - name: Check for drift
        run: aligntrue drift --sarif > drift.sarif

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: drift.sarif
```

### GitLab CI

```yaml
drift-detection:
  stage: test
  script:
    - npm install -g @aligntrue/cli
    - aligntrue drift --gates
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'
```

### Pre-commit hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Check for drift before committing lockfile changes
if git diff --cached --name-only | grep -q ".aligntrue.lock.json"; then
  echo "Lockfile changed, checking for drift..."
  aligntrue drift --gates
fi
```

## Troubleshooting

### "Drift detection requires team mode"

**Cause:** Running `aligntrue drift` in solo mode.

**Solution:**

```bash
# Enable team mode
aligntrue team enable

# Or set in config
echo "mode: team" >> .aligntrue/config.yaml
```

### "Lockfile not found"

**Cause:** No lockfile generated yet.

**Solution:**

```bash
# Generate lockfile
aligntrue sync
```

### "Allow list not found"

**Cause:** No sources approved yet.

**Solution:**

```bash
# Approve sources
aligntrue team approve <source>

# Or create allow list manually
# .aligntrue/allow.yaml
```

### False positives

**Scenario:** Drift reported but you know rules haven't changed.

**Debugging:**

1. Check lockfile generation date
2. Verify allow list hashes
3. Re-sync to update lockfile
4. Check for local modifications

**Solution:**

```bash
# Regenerate lockfile
aligntrue sync --force

# Update allow list
aligntrue team approve <source>@latest
```

## Configuration

Drift detection uses your existing AlignTrue configuration:

```yaml
# .aligntrue/config.yaml
mode: team # Required for drift detection

# Lockfile settings
modules:
  lockfile: true # Required

lockfile:
  mode: soft # or strict

# Performance settings (optional)
performance:
  max_file_size_kb: 1024
  respect_gitignore: true
```

## Best practices

### Regular monitoring

- Run `aligntrue drift` in CI daily or on schedule
- Use `--gates` flag in PR checks to block on drift
- Review drift reports during team sync meetings

### When to use --gates

**Use `--gates` flag when:**

- Enforcing strict version control
- Blocking PRs with unauthorized changes
- Maintaining compliance requirements

**Don't use `--gates` when:**

- Exploring drift informally
- Learning about upstream changes
- Testing new rule versions

### Handling drift findings

**Upstream drift:**

1. Review changelog for upstream pack
2. Test changes in dev environment
3. Approve new version or pin current
4. Update documentation

**Vendorized drift:**

1. Check git submodule/subtree status
2. Update vendored pack if appropriate
3. Re-link and re-sync
4. Commit vendored changes

## Related documentation

- [Team mode](./team-mode.md) - Team collaboration features
- [Git workflows](./git-workflows.md) - Pull and link commands
- [Commands](./commands.md) - All CLI commands reference

## See also

- **Allow list**: `.aligntrue/allow.yaml` format and approval workflow
- **Lockfile**: `.aligntrue.lock.json` generation and validation
- **Team mode**: Enabling and configuring team collaboration
