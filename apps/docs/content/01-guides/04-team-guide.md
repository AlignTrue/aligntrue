---
title: Team guide
description: Complete guide for team collaboration with AlignTrue - shared standards, reproducibility, and drift detection
---

# Team guide

This guide shows how teams use AlignTrue to maintain consistent AI agent behavior across team members with reproducible builds, drift detection, and approval workflows.

> **Quick start guide** for team collaboration. For comprehensive reference on team mode features and configuration, see [Team Mode Concepts](/docs/03-concepts/team-mode).

> **See it in action:** Check out the [team repo example](https://github.com/AlignTrue/aligntrue/tree/main/examples/team-repo) for team workflows, and [overlays example](https://github.com/AlignTrue/aligntrue/tree/main/examples/overlays-demo) for customization patterns.

## Quick team setup

```bash
# 1. Enable team mode
aligntrue team enable

# 2. Generate lockfile
aligntrue sync

# 3. Commit to git (approval via PR review)
git add .aligntrue/ .aligntrue.lock.json
git commit -m "chore: Enable AlignTrue team mode"
git push origin main
```

**Result:** Team gets reproducible builds with drift detection.

## Team mode features

**What you get:**

- **Lockfile** - Reproducible builds with pinned hashes
- **Allow list** - Approved rule sources only
- **Drift detection** - Detect upstream changes and local modifications
- **Bundle** - Dependency merging with precedence rules
- **Audit trail** - Track who changed what and when
- **Team-managed sections** - Protect specific sections from individual edits (see [Team-managed sections guide](/docs/01-guides/08-team-managed-sections))

**What changes from solo mode:**

- Lockfile enabled (off/soft/strict validation)
- Allow list required (approved sources only)
- Bundle enabled (dependency merging)
- Auto-pull disabled by default (explicit updates)

## Team setup workflow

### Step 1: Enable team mode

```bash
cd your-repo
aligntrue team enable
```

**What it does:**

- Creates `.aligntrue.lock.json` (lockfile)
- Creates `.aligntrue.allow` (allow list)
- Sets mode to `team` in config
- Enables lockfile validation (soft by default)

**Lockfile modes:**

- `off` - No validation (like solo mode)
- `soft` - Warn on drift, don't block
- `strict` - Block on drift, require exact match

### Step 2: Configure sources

Add sources to `.aligntrue/config.yaml`:

```yaml
sources:
  - type: git
    url: https://github.com/AlignTrue/aligntrue
    path: examples/packs/global.yaml
  - type: git
    url: https://github.com/org/standards
    path: typescript-standards.yaml
```

**Note:** Source approval happens via git PR review workflow.

**Allow list format:**

```yaml
# .aligntrue.allow
allowed_sources:
  - type: git
    value: https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml

  - type: git
    value: https://github.com/org/standards/typescript-standards.yaml
    profile: org/standards
    version: v2.0.0
```

### Step 3: Generate lockfile

```bash
aligntrue sync
```

**Lockfile structure:**

```json
{
  "spec_version": "1",
  "generated_at": "2025-10-31T12:00:00Z",
  "dependencies": {
    "global-pack": {
      "version": "v1.0.0",
      "source": {
        "type": "git",
        "url": "https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml"
      },
      "base_hash": "sha256:abc123...",
      "overlay_hash": "sha256:def456...",
      "result_hash": "sha256:ghi789..."
    }
  }
}
```

### Step 4: Commit to git

```bash
git add .aligntrue/ .aligntrue.lock.json
git commit -m "chore: Enable AlignTrue team mode"
git push
```

**What to commit:**

- `.aligntrue/.rules.yaml` - Internal IR (auto-generated)
- `.aligntrue/config.yaml` - Team configuration
- `.aligntrue.allow` - Approved sources
- `.aligntrue.lock.json` - Lockfile with pinned hashes
- `.cursor/rules/` - Exported Cursor rules (optional)
- `AGENTS.md` - Universal agent format (optional)

**What NOT to commit:**

- `.aligntrue/.cache/` - Cache directory
- `.aligntrue/privacy-consent.json` - Per-machine consent

## Collaboration scenarios

### Scenario 1: Onboarding new team members

**Goal:** New developer gets exact same rules as team.

**Steps:**

```bash
# 1. Clone repo
git clone https://github.com/org/project
cd project
```

**Install CLI:**

<Tabs items={["npm", "yarn", "pnpm", "bun"]}>

<Tabs.Tab>`bash npm install -g aligntrue `</Tabs.Tab>

<Tabs.Tab>`bash yarn global add aligntrue `</Tabs.Tab>

<Tabs.Tab>`bash pnpm add -g aligntrue `</Tabs.Tab>

<Tabs.Tab>`bash bun install -g aligntrue `</Tabs.Tab>

</Tabs>

**Sync (pulls from lockfile):**

```bash
aligntrue sync

# Output:
# ✓ Validated lockfile (strict mode)
# ✓ Pulled 3 sources
# ✓ Applied 2 overlays
# ✓ Exported to cursor, agents
```

**Result:** New developer has identical rules as team (byte-identical exports).

### Scenario 2: Sharing team standards

**Goal:** Maintain team-specific standards across projects.

**Setup:**

```bash
# 1. Create team standards repo
mkdir team-standards
cd team-standards
git init

# 2. Create rules pack
cat > rules.yaml <<EOF
id: team-standards
version: 1.0.0
spec_version: "1"
profile:
  id: org/team-standards
  version: 1.0.0

rules:
  - id: team.no-console-log
    summary: No console.log in production
    severity: error
    guidance: Use proper logging library
    applies_to: ["**/*.ts"]

plugs:
  slots:
    test.cmd:
      description: "Team test command"
      format: command
      required: true
      example: "pnpm test"
  fills:
    test.cmd: "pnpm test"  # Team default
EOF

# 3. Commit and push
git add rules.yaml
git commit -m "Initial team standards"
git push

# 4. Use in projects
cd ~/projects/team-project
aligntrue init

# Add to .aligntrue/.rules.yaml:
sources:
  - git: https://github.com/org/team-standards
    ref: v1.0.0

# 5. Sync and commit (approval via PR)
aligntrue sync
git add .aligntrue/ .aligntrue.lock.json
git commit -m "Add team standards"
git push origin main
```

**Result:** All team projects use shared standards.

### Scenario 3: Customizing for team needs

**Goal:** Use upstream pack but adjust severity for team preferences.

**Setup:**

```yaml
# .aligntrue/.rules.yaml
sources:
  - git: https://github.com/community/typescript-pack
    ref: v1.0.0

# Team prefers stricter enforcement
overlays:
  overrides:
    # Team policy: No console.log (approved 2025-10-15)
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error" # Upgrade from warning

    # Team policy: No any types (approved 2025-10-15)
    - selector: "rule[id=no-any-type]"
      set:
        severity: "error" # Upgrade from warning
```

**Workflow:**

```bash
# 1. Team lead adds overlays
# (edit .aligntrue/.rules.yaml)

# 2. Sync and test
aligntrue sync
aligntrue check

# 3. Commit with team approval
git add .aligntrue/
git commit -m "chore: Enforce stricter console.log and any-type rules

Approved by: @team-lead
Reviewed by: @senior-dev1, @senior-dev2"
git push

# 4. Team members pull and sync
git pull
aligntrue sync
```

**Result:** Team uses customized pack without forking.

### Scenario 4: Monorepo with multiple teams

**Goal:** Different teams own different parts of monorepo with team-specific rules.

**Structure:**

```
company-monorepo/
├── apps/
│   ├── web/          # Team A: Frontend
│   └── mobile/       # Team B: Mobile
├── packages/
│   ├── api/          # Team C: Backend
│   └── shared/       # Shared utilities
└── services/
    └── worker/       # Team D: Workers
```

**Configuration:**

```yaml
# .aligntrue/.rules.yaml
sources:
  - git: https://github.com/company/base-standards
    ref: v2.0.0
  - git: https://github.com/company/frontend-standards
    ref: v1.0.0
  - git: https://github.com/company/backend-standards
    ref: v1.0.0

scopes:
  # Team A: Frontend (owner: @frontend-team)
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-standards", "frontend-standards"]

  # Team B: Mobile (owner: @mobile-team)
  - path: "apps/mobile"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-standards", "frontend-standards"]

  # Team C: Backend (owner: @backend-team)
  - path: "packages/api"
    include: ["**/*.ts"]
    rulesets: ["base-standards", "backend-standards"]

  # Shared: Base only (owner: @platform-team)
  - path: "packages/shared"
    include: ["**/*.ts"]
    rulesets: ["base-standards"]

# Team-specific plugs
plugs:
  fills:
    test.cmd: "pnpm test"
    org.name: "Acme Corp"

# Team-specific overlays
overlays:
  overrides:
    # Company policy: No console.log
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

**Workflow:**

```bash
# 1. Enable team mode
aligntrue team enable

# 2. Sync and verify
aligntrue sync
aligntrue scopes

# 3. Commit (approval via PR)
git add .aligntrue/ .aligntrue.lock.json
git commit -m "chore: Configure team scopes and standards"
git push origin main
```

**Result:** Each team gets appropriate rules while sharing base standards.

### Scenario 5: Updating upstream packs

**Goal:** Update to new version of upstream pack safely.

**Workflow:**

```bash
# 1. Check for drift
aligntrue drift

# Output:
# Upstream drift detected:
#   git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml
#   - Current: sha256:abc123...
#   - Latest: sha256:def456...
#   - Changes: 3 new rules, 2 modified rules

# 2. Review changes
aligntrue update check

# Output:
# Update available: base-global v1.0.0 → v1.1.0
#
# New rules (3):
#   - security.check-deps
#   - security.no-eval
#   - testing.coverage-threshold
#
# Modified rules (2):
#   - testing.require-tests (severity: warn → error)
#   - docs.require-readme (applies_to: ["README.md"] → ["*.md"])

# 3. Apply update
aligntrue update apply

# 4. Test with team
aligntrue check
aligntrue sync

# 5. Commit with changelog
git add .aligntrue.lock.json
git commit -m "chore: Update base-global to v1.1.0

Changes:
- Added 3 new security rules
- Upgraded testing.require-tests to error
- Extended docs.require-readme to all markdown files

Tested by: @dev1, @dev2"
git push
```

**Result:** Team updates to new version with full visibility into changes.

## Drift detection

Team mode provides comprehensive drift detection to catch misalignment early. The `aligntrue drift` command detects three types of drift:

### 1. Lockfile drift

**What it detects:** Rules have changed since last lockfile generation.

**When it happens:**

- Someone edited `.aligntrue/.rules.yaml` directly
- Rules were imported from agent files (`--accept-agent`)
- Bundle dependencies changed

**How to detect:**

```bash
aligntrue drift

# Output:
# LOCKFILE DRIFT:
#   _bundle
#     Rules have changed since last lockfile generation
#     Old bundle: sha256:abc123...
#     New bundle: sha256:def456...
#     Suggestion: Run: aligntrue sync (to regenerate lockfile)
```

**How to resolve:**

```bash
# Regenerate lockfile with new bundle hash
aligntrue sync

# Commit the updated lockfile (approval via PR)
git add .aligntrue.lock.json
git commit -m "chore: Update lockfile after rule changes"
git push origin main
```

**Lockfile modes:**

- **`off`** - No validation (like solo mode)
- **`soft`** - Warn on drift, allow sync to continue
- **`strict`** - Block sync until hash is approved

**Interactive vs CI behavior:**

In **strict mode**:

- **Interactive terminal** - Prompts to approve new hash
- **CI/non-interactive** - Exits with code 1, requires manual approval

```yaml
# .aligntrue/config.yaml
lockfile:
  mode: strict # Block unapproved changes
```

### 2. Agent file drift

**What it detects:** Agent files (AGENTS.md, .cursor/rules/\*.mdc) modified after IR.

**When it happens:**

- Developer edited AGENTS.md directly in team mode
- Cursor rules file modified outside of AlignTrue sync

**Why it matters:** In team mode, IR (`.aligntrue/.rules.yaml`) is the single source of truth. Editing agent files directly bypasses lockfile validation and can cause divergence.

**How to detect:**

```bash
aligntrue drift

# Output:
# AGENT FILE DRIFT:
#   _agent_agents
#     AGENTS.md modified after last sync
#     Suggestion: Run: aligntrue sync --accept-agent agents
```

**How to resolve:**

Option 1: Accept agent changes (pull into IR):

```bash
# Import changes from agent file into IR
aligntrue sync --accept-agent agents

# This will:
# 1. Parse AGENTS.md
# 2. Update .aligntrue/.rules.yaml
# 3. Regenerate lockfile
# 4. Prompt to approve new bundle hash (if strict mode)
```

Option 2: Discard agent changes (overwrite from IR):

```bash
# Sync IR to agents (overwrites AGENTS.md)
aligntrue sync

# Agent file will be regenerated from IR
```

**Prevention:** In team mode, `aligntrue sync` shows a warning when agent files are newer than IR:

```bash
aligntrue sync

# Output:
# ⚠ AGENTS.md modified after IR
#   In team mode, edit .aligntrue/.rules.yaml instead
#   Or run: aligntrue sync --accept-agent agents
```

### 3. Upstream drift

**What it detects:** Upstream pack content changed since lockfile generation.

**When it happens:**

- Upstream pack repository updated
- New version published to catalog
- Git source ref changed

**How to detect:**

```bash
aligntrue drift

# Output:
# UPSTREAM DRIFT:
#   git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml
#     Upstream pack has been updated (base_hash differs)
#     Lockfile: sha256:abc123...
#     Allowed: sha256:def456...
#     Suggestion: Run: aligntrue update apply
```

**How to resolve:**

```bash
# Check what changed
aligntrue update check

# Apply update
aligntrue update apply

# Commit changes (approval via PR)
git add .aligntrue.lock.json
git commit -m "chore: Apply upstream updates"
git push origin main
```

### Drift detection in CI

**Exit codes:**

```bash
aligntrue drift          # Exit 0 (always)
aligntrue drift --gates  # Exit 2 if drift detected
```

**CI integration:**

```yaml
# .github/workflows/pr.yml
- name: Detect drift
  run: aligntrue drift --gates
# Fails PR if any drift detected
```

**JSON output for tooling:**

```bash
aligntrue drift --json

# Output:
{
  "mode": "team",
  "has_drift": true,
  "lockfile_path": ".aligntrue.lock.json",
  "findings": [
    {
      "category": "lockfile",
      "ruleId": "_bundle",
      "description": "Rules have changed since last lockfile generation",
      "suggestion": "Run: aligntrue sync (to regenerate lockfile)",
      "lockfile_hash": "abc123...",
      "expected_hash": "def456..."
    }
  ],
  "summary": {
    "total": 1,
    "by_category": {
      "lockfile": 1,
      "agent_file": 0,
      "upstream": 0,
      "severity_remap": 0,
      "vendorized": 0
    }
  }
}
```

### Drift detection best practices

**1. Run drift checks regularly:**

```bash
# Before starting work
aligntrue drift

# Before committing
aligntrue drift --gates
```

**2. Set up automated drift detection:**

```yaml
# .github/workflows/drift.yml
name: Drift Detection

on:
  schedule:
    - cron: "0 9 * * MON" # Every Monday at 9am

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install AlignTrue CLI
        run: npm install -g aligntrue
      - name: Check for drift
        run: aligntrue drift --gates
```

**3. Document drift resolution in commits:**

```bash
git commit -m "fix: Resolve lockfile drift

- Regenerated lockfile after rule changes
- Approved new bundle hash: sha256:abc123...
- Tested with: aligntrue check && aligntrue sync"
```

**4. Use strict mode in production:**

```yaml
# .aligntrue/config.yaml
lockfile:
  mode: strict # Block unapproved changes
```

**5. Review drift in PRs:**

```yaml
# .github/workflows/pr.yml
- name: Detect drift
  run: |
    aligntrue drift --json > drift-report.json
    cat drift-report.json

- name: Comment on PR
  if: failure()
  uses: actions/github-script@v6
  with:
    script: |
      const fs = require('fs');
      const drift = JSON.parse(fs.readFileSync('drift-report.json'));

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `⚠️ Drift detected:\n\`\`\`json\n${JSON.stringify(drift, null, 2)}\n\`\`\``
      });
```

## Customization patterns

### Plugs: Team-specific values

**Use plugs for:**

- Organization name
- Team-specific test commands
- Shared documentation URLs

**Example:**

```yaml
plugs:
  fills:
    org.name: "Acme Corp"
    test.cmd: "pnpm test"
    docs.url: "https://docs.acme.com"
```

**Workflow:**

```bash
# Team lead sets fills
aligntrue plugs set org.name "Acme Corp"
aligntrue plugs set test.cmd "pnpm test"

# Commit
git add .aligntrue/config.yaml
git commit -m "chore: Set team plug values"
```

### Overlays: Team severity preferences

**Use overlays for:**

- Team-wide severity adjustments
- Customizing third-party packs to team standards
- Temporary overrides during migrations

**Example:**

```yaml
overlays:
  overrides:
    # Team policy: Stricter than upstream
    # Approved: 2025-10-15
    # Owner: @platform-team
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"

    # TEMPORARY: Migration in progress
    # Expires: 2025-12-31
    # Owner: @backend-team
    - selector: "rule[id=strict-null-checks]"
      set:
        severity: "warn"
```

**Workflow:**

```bash
# Team lead adds overlay
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error

# Review and commit
aligntrue override status
git add .aligntrue/config.yaml
git commit -m "chore: Enforce no-console-log as error

Approved by: @team-lead
Reviewed by: @senior-dev1, @senior-dev2"
```

### Scopes: Team boundaries

**Use scopes for:**

- Team ownership boundaries in monorepo
- Different tech stacks per team
- Shared base + team-specific overrides

**Example:**

```yaml
scopes:
  # Team A owns frontend
  # Owner: @frontend-team
  - path: "apps/web"
    rulesets: ["base-standards", "frontend-standards"]

  # Team B owns backend
  # Owner: @backend-team
  - path: "packages/api"
    rulesets: ["base-standards", "backend-standards"]
```

## CI/CD integration

### Validate lockfile in CI

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  aligntrue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install AlignTrue CLI
        run: npm install -g aligntrue

      - name: Validate lockfile
        run: aligntrue check --ci

      - name: Detect drift
        run: aligntrue drift --ci
```

**What it validates:**

- Lockfile exists and is valid
- All sources are approved (allow list)
- No drift from lockfile
- All required plugs filled

### Detect drift automatically

```yaml
# .github/workflows/drift.yml
name: Drift Detection

on:
  schedule:
    - cron: "0 9 * * MON" # Every Monday at 9am

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install AlignTrue CLI
        run: npm install -g aligntrue

      - name: Check for drift
        run: aligntrue drift --json > drift-report.json

      - name: Create issue if drift detected
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const drift = JSON.parse(fs.readFileSync('drift-report.json'));

            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: 'AlignTrue drift detected',
              body: `Drift detected:\n\`\`\`json\n${JSON.stringify(drift, null, 2)}\n\`\`\``,
              labels: ['aligntrue', 'drift']
            });
```

### Block unapproved sources

```yaml
# .github/workflows/pr.yml
name: PR Checks

on: pull_request

jobs:
  aligntrue:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install AlignTrue CLI
        run: npm install -g aligntrue

      - name: Validate sources
        run: |
          # Fail if unapproved sources
          aligntrue team list-allowed
          aligntrue check --ci
```

## Team workflows

### PR review checklist

**When reviewing AlignTrue changes:**

- [ ] Lockfile updated if sources changed
- [ ] Allow list updated if new sources added
- [ ] Overlays documented with reason and owner
- [ ] Plugs filled for required slots
- [ ] Scopes validated with `aligntrue scopes`
- [ ] Changes tested locally with `aligntrue sync`
- [ ] CI passes with `aligntrue check --ci`

**Example PR description:**

````markdown
## Changes

- Add TypeScript standards pack
- Customize severity for team preferences
- Set team-specific plug values

## AlignTrue checklist

- [x] Lockfile updated
- [x] Source approved in allow list
- [x] Overlays documented
- [x] Plugs filled
- [x] CI passes

## Testing

```bash
aligntrue sync
aligntrue check
```
````

Tested by: @dev1, @dev2

````

### Handling conflicts

**Scenario:** Two developers modify rules simultaneously.

**Resolution:**

```bash
# 1. Pull latest
git pull origin main

# Conflict in AGENTS.md or .aligntrue/config.yaml

# 2. Resolve conflict manually
# (edit AGENTS.md or .aligntrue/config.yaml)

# 3. Regenerate lockfile
aligntrue sync

# 4. Validate
aligntrue check

# 5. Commit resolution
git add AGENTS.md .aligntrue/ .aligntrue.lock.json
git commit -m "chore: Resolve AlignTrue conflict"
````

### Emergency overrides (--force)

**When to use:**

- Production incident requires immediate rule change
- Drift detection blocking critical deployment
- Allow list validation failing in emergency

**Workflow:**

```bash
# 1. Override validation
aligntrue sync --force

# 2. Deploy fix
# ... deploy ...

# 3. Fix properly afterward
aligntrue sync
git add .aligntrue.lock.json
git commit -m "chore: Update lockfile"
git push origin main

# 4. Document in postmortem
```

**Warning:** Use `--force` sparingly. It bypasses safety checks.

## Best practices

### Document customization decisions

Always explain why using comments:

```yaml
overlays:
  overrides:
    # Team policy: No console.log in production
    # Approved: 2025-10-15 by @team-lead
    # Reviewed: @senior-dev1, @senior-dev2
    # Reason: Enforce proper logging library usage
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

### Review overlays periodically

Monthly overlay review:

```bash
# 1. Audit all overlays
aligntrue override status

# 2. Check for stale overlays
aligntrue override diff

# 3. Remove unnecessary overlays
aligntrue override remove 'rule[id=...]'

# 4. Document review
git commit -m "chore: Monthly overlay review - removed 3 stale overlays"
```

### Keep allow list minimal

Only approve sources you trust:

```yaml
# Good: Minimal allow list
allowed_sources:
  - type: git
    value: https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml

  - type: git
    value: https://github.com/org/team-standards.yaml
    profile: org/team-standards
    version: v2.0.0

# Bad: Too permissive
allowed_sources:
  - id: "*"  # Allows anything (don't do this)
```

### Version control everything

Commit all team configuration:

```bash
git add .aligntrue/ .aligntrue.lock.json
git commit -m "chore: Update AlignTrue configuration"
```

### Communicate changes

Use PR descriptions and commit messages to explain changes:

```bash
git commit -m "chore: Update TypeScript standards to v2.0.0

Changes:
- Added 3 new security rules
- Upgraded testing.require-tests to error
- Extended docs.require-readme to all markdown files

Impact: All TypeScript files now require tests
Action required: Add tests to new files

Approved by: @team-lead
Tested by: @dev1, @dev2, @dev3"
```

## Related documentation

- [Customization Overview](/docs/02-customization/) - Plugs, overlays, and scopes
- [Plugs Guide](/docs/02-customization/plugs) - Team-specific values
- [Overlays Guide](/docs/02-customization/overlays) - Team severity preferences
- [Scopes Guide](/docs/02-customization/scopes) - Team boundaries in monorepo
- [Team Mode](/docs/03-concepts/team-mode) - Team mode concepts
- [Drift Detection](/docs/03-concepts/drift-detection) - Drift detection details
- [CLI Reference](/docs/04-reference/cli-reference) - Complete command docs
- [Solo Developer Guide](/docs/01-guides/02-solo-developer-guide) - Solo workflow

## Summary

**Team collaboration workflow:**

1. **Enable team mode** - `aligntrue team enable`
2. **Configure sources** - Add to `.aligntrue/config.yaml`
3. **Generate lockfile** - `aligntrue sync`
4. **Commit to git** - Share with team (approval via PR)
5. **Onboard members** - `git clone && aligntrue sync`
6. **Update safely** - `aligntrue drift && aligntrue update`

**Key principles:**

- Reproducible builds with lockfile
- Approved sources only (allow list)
- Drift detection for upstream changes
- Document all customizations
- Review changes in PRs
- Validate in CI

**Next steps:**

- Set up [CI/CD integration](/docs/01-guides/10-ci-cd-integration)
- Configure [drift detection](/docs/03-concepts/drift-detection)
- Review [team mode concepts](/docs/03-concepts/team-mode)
