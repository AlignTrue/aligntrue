# Developer onboarding

The `aln onboard` command generates personalized onboarding checklists for developers based on recent work, check results, and project state.

## Overview

`aln onboard` analyzes your development context and creates an actionable checklist with:

- Recent commit history and file changes
- Failed or warnings from checks
- Team drift status (in team mode)
- Unresolved required plugs
- Common patterns (missing tests, documentation updates)

This helps developers quickly identify next steps and reduces onboarding friction.

## Use cases

### New team member first setup

When joining a project:

```bash
aln onboard
```

Shows essential setup steps based on project configuration.

### After PR review

Address review feedback systematically:

```bash
aln onboard --ci sarif.json
```

Integrates CI check results to highlight failures that need attention.

### After pulling upstream changes

Get oriented after syncing with main:

```bash
git pull origin main
aln onboard
```

Highlights changes that might affect your work.

### Before committing

Pre-flight check before pushing:

```bash
aln onboard
```

Catch common issues (missing tests, uncommitted files) before CI runs.

## Command reference

```bash
aln onboard [options]
```

### Options

- `--ci <path>` — Path to SARIF file with CI check results
- `--config <path>` — Custom config file path (default: `.aligntrue.yaml`)
- `--help` — Show help message

### Examples

```bash
# Basic onboarding checklist
aln onboard

# Include CI check results
aln onboard --ci .aligntrue/.cache/checks.sarif

# Use custom config
aln onboard --config custom-config.yaml
```

## Checklist format

The onboard command generates a checklist with priority icons:

- **⚠️ Warning** — Issues that should be addressed
- **ℹ️ Info** — Helpful context and suggestions
- **✅ Action** — Required next steps

Each item includes:

- Clear description of the issue or action
- Related files or context
- Suggested command to run (when applicable)

Example output:

```
🚀 Developer Onboarding Checklist

Based on your recent work:
  Last commit: feat: Add user authentication
  By: Jane Developer
  Files changed: 8

Actionable next steps:

1. ⚠️ Uncommitted changes detected
   You have uncommitted changes in your working directory
   Consider committing or stashing before proceeding
   → Run: git status

2. ✅ Run tests (3 test files modified)
   - src/auth.test.ts
   - src/user.test.ts
   - src/session.test.ts
   → Run: pnpm test

3. ⚠️ Resolve 2 unresolved plugs
   - db.connection.string: Run 'aligntrue plugs set db.connection.string <value>'
   - api.jwt.secret: Run 'aligntrue plugs set api.jwt.secret <value>'
   → Run: aligntrue plugs audit
```

## Integrations

### Drift detection (team mode)

In team mode, `aln onboard` automatically checks for drift from approved sources:

```yaml
# .aligntrue.yaml
mode: team
```

When drift is detected:

```
⚠️ Team drift detected (2 sources)
   Categories: upstream, vendorized
   Sources have drifted from allowed versions
   → Run: aligntrue drift
```

See [drift detection](/docs/02-concepts/drift-detection) for details.

### Check results integration

Pass SARIF output from CI to show failed checks:

```bash
# After CI run
aln onboard --ci .github/workflows/sarif-output.json
```

Checklist includes check failures:

```
⚠️ 3 checks failed
   Check failed: Missing required file
   Warning found: Deprecated dependency
   Check failed: Test coverage below threshold
   → Run: aligntrue check
```

### Plugs integration

Automatically detects unresolved required plugs:

```yaml
# .aligntrue.yaml
plugs:
  slots:
    db.url:
      required: true
      format: url
      description: Database connection URL
```

When slots need values:

```
⚠️ Resolve 1 unresolved plug
   - db.url: Run 'aligntrue plugs set db.url <value>'
   → Run: aligntrue plugs audit
```

See [plugs documentation](https://github.com/AlignTrue/aligntrue/blob/main/.cursor/rules/plugs.mdc) for details.

## CI workflow integration

### GitHub Actions

Add onboarding to your PR workflow:

```yaml
name: Onboard
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  onboard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install AlignTrue
        run: npm install -g @aligntrue/cli

      - name: Run checks (generate SARIF)
        run: aln check --format sarif > checks.sarif
        continue-on-error: true

      - name: Generate onboarding checklist
        run: aln onboard --ci checks.sarif

      - name: Post checklist as comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const output = fs.readFileSync('onboard-output.txt', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Onboarding Checklist\\n\\n\`\`\`\\n${output}\\n\`\`\``
            });
```

### GitLab CI

```yaml
onboard:
  stage: test
  script:
    - npm install -g @aligntrue/cli
    - aln check --format sarif > checks.sarif || true
    - aln onboard --ci checks.sarif
  artifacts:
    reports:
      junit: checks.sarif
```

### Generic CI

Any CI system with SARIF support:

1. Run checks and save SARIF output
2. Pass SARIF file to onboard command
3. Display or archive checklist output

```bash
# Example CI script
aln check --format sarif > checks.sarif
aln onboard --ci checks.sarif > onboard-checklist.txt
```

## Troubleshooting

### No git history

**Symptom:** Checklist shows default items only

**Cause:** Not in a git repository or no commits yet

**Solution:** Initialize git and make first commit, or run from a git repository

```bash
git init
git add .
git commit -m "Initial commit"
aln onboard
```

### CI artifacts not found

**Symptom:** `--ci` flag shows no additional items

**Cause:** SARIF file doesn't exist or is malformed

**Solution:** Verify SARIF file path and format

```bash
# Check if file exists
ls -la checks.sarif

# Validate SARIF format
cat checks.sarif | jq .
```

### Plugs audit fails

**Symptom:** Error when detecting unresolved plugs

**Cause:** `.aligntrue.yaml` not found or has invalid plugs syntax

**Solution:** Verify config file exists and has valid plugs schema

```bash
# Check config exists
cat .aligntrue.yaml

# Validate config
aln check
```

### Drift detection not working

**Symptom:** No drift information shown in team mode

**Cause:** Not in team mode, or lockfile missing

**Solution:** Enable team mode and generate lockfile

```bash
# Enable team mode
aln team enable

# Generate lockfile
aln sync

# Verify drift detection works
aln drift
```

## See also

- [Commands reference](/docs/03-reference/cli-reference)
- [Team mode guide](/docs/02-concepts/team-mode)
- [Drift detection](/docs/02-concepts/drift-detection)
- [Git workflows](/docs/02-concepts/git-workflows)
