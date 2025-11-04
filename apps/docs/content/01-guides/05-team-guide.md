---
title: Team guide
description: Complete guide for team collaboration with AlignTrue - shared standards, reproducibility, and drift detection
---

# Team guide

This guide shows how teams use AlignTrue to maintain consistent AI agent behavior across team members with reproducible builds, drift detection, and approval workflows.

## Quick team setup

```bash
# 1. Enable team mode
aligntrue team enable

# 2. Approve sources
aligntrue team approve base-global@aligntrue/catalog@v1.0.0

# 3. Generate lockfile
aligntrue sync

# 4. Commit to git
git add .aligntrue/ .aligntrue.lock.json
git commit -m "chore: Enable AlignTrue team mode"
```

**Result:** Team gets reproducible builds with drift detection.

## Team mode features

**What you get:**

- **Lockfile** - Reproducible builds with pinned hashes
- **Allow list** - Approved rule sources only
- **Drift detection** - Detect upstream changes and local modifications
- **Bundle** - Dependency merging with precedence rules
- **Audit trail** - Track who changed what and when

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
- Creates `.aligntrue/allow.yaml` (allow list)
- Sets mode to `team` in config
- Enables lockfile validation (soft by default)

**Lockfile modes:**

- `off` - No validation (like solo mode)
- `soft` - Warn on drift, don't block
- `strict` - Block on drift, require exact match

### Step 2: Create allow list

```bash
# Approve sources
aligntrue team approve base-global@aligntrue/catalog@v1.0.0
aligntrue team approve typescript-standards@org/standards@v2.0.0

# List approved
aligntrue team list-allowed

# Output:
# Approved sources (2):
#   base-global@aligntrue/catalog@v1.0.0
#   typescript-standards@org/standards@v2.0.0
```

**Allow list format:**

```yaml
# .aligntrue/allow.yaml
allowed_sources:
  - id: base-global
    profile: aligntrue/catalog
    version: v1.0.0

  - id: typescript-standards
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
    "base-global@aligntrue/catalog": {
      "version": "v1.0.0",
      "source": {
        "type": "catalog",
        "id": "base-global"
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

- `.aligntrue/rules.md` - Rules configuration
- `.aligntrue/config.yaml` - Team configuration
- `.aligntrue/allow.yaml` - Approved sources
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

# 2. Install CLI
npm install -g @aligntrue/cli@next

# 3. Sync (pulls from lockfile)
aligntrue sync

# Output:
# ✓ Validated lockfile (strict mode)
# ✓ Pulled 3 sources
# ✓ Applied 2 overlays
# ✓ Exported to cursor, agents-md
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

# Add to .aligntrue/rules.md:
sources:
  - git: https://github.com/org/team-standards
    ref: v1.0.0

# 5. Approve and sync
aligntrue team approve team-standards@org/team-standards@v1.0.0
aligntrue sync

# 6. Commit
git add .aligntrue/ .aligntrue.lock.json
git commit -m "Add team standards"
```

**Result:** All team projects use shared standards.

### Scenario 3: Customizing for team needs

**Goal:** Use upstream pack but adjust severity for team preferences.

**Setup:**

```yaml
# .aligntrue/rules.md
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
# (edit .aligntrue/rules.md)

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
# .aligntrue/rules.md
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

# 2. Approve all sources
aligntrue team approve base-standards@company/base-standards@v2.0.0
aligntrue team approve frontend-standards@company/frontend-standards@v1.0.0
aligntrue team approve backend-standards@company/backend-standards@v1.0.0

# 3. Sync
aligntrue sync

# 4. Verify scopes
aligntrue scopes

# 5. Commit
git add .aligntrue/ .aligntrue.lock.json
git commit -m "chore: Configure team scopes and standards"
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
#   base-global@aligntrue/catalog
#   - Current: v1.0.0 (sha256:abc123...)
#   - Latest: v1.1.0 (sha256:def456...)
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
git add .aligntrue/rules.md
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
git add .aligntrue/rules.md
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
        run: npm install -g @aligntrue/cli@next

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
        run: npm install -g @aligntrue/cli@next

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
        run: npm install -g @aligntrue/cli@next

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

# Conflict in .aligntrue/rules.md

# 2. Resolve conflict manually
# (edit .aligntrue/rules.md)

# 3. Regenerate lockfile
aligntrue sync

# 4. Validate
aligntrue check

# 5. Commit resolution
git add .aligntrue/ .aligntrue.lock.json
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
aligntrue team approve <source>
aligntrue sync

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
  - id: base-global
    profile: aligntrue/catalog
    version: v1.0.0

  - id: team-standards
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
- [Team Mode](/docs/02-concepts/team-mode) - Team mode concepts
- [Drift Detection](/docs/02-concepts/drift-detection) - Drift detection details
- [CLI Reference](/docs/03-reference/cli-reference) - Complete command docs
- [Solo Developer Guide](./solo-developer-guide) - Solo workflow

## Summary

**Team collaboration workflow:**

1. **Enable team mode** - `aligntrue team enable`
2. **Create allow list** - `aligntrue team approve <sources>`
3. **Generate lockfile** - `aligntrue sync`
4. **Commit to git** - Share with team
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

- Set up [CI/CD integration](/docs/01-guides/ci-cd-integration)
- Configure [drift detection](/docs/02-concepts/drift-detection)
- Review [team mode concepts](/docs/02-concepts/team-mode)
