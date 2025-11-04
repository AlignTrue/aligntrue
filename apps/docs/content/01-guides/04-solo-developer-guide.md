---
title: Solo Developer Guide
description: Complete guide for individual developers using AlignTrue across personal projects
---

# Solo developer guide

This guide shows how solo developers use AlignTrue to maintain consistent AI agent behavior across personal projects without team overhead.

## Quick setup (60 seconds)

```bash
# Install CLI
npm install -g @aligntrue/cli@next

# Initialize project
cd my-project
aligntrue init

# Sync to agents
aligntrue sync
```

**Result:** Rules synced to Cursor and AGENTS.md. Start coding with consistent agent behavior.

## Solo mode features

**What you get:**

- Local-first operation (no required network calls)
- Lockfile disabled by default (no drift detection overhead)
- Bundle disabled by default (no dependency merging)
- Fast iteration with auto-pull
- Full customization (plugs, overlays, scopes)

**What you don't need:**

- Team mode (enable with `aligntrue team enable` if needed)
- Allow lists (no source approval required)
- Lockfile validation (enable if you want reproducibility)

## Daily workflow scenarios

### Scenario 1: Starting a new project

**Goal:** Set up AlignTrue with sensible defaults in under 60 seconds.

**Steps:**

```bash
# 1. Initialize project
cd my-new-project
aligntrue init

# Interactive prompts:
# - Project name: my-new-project
# - Primary agent: cursor
# - Include base-global pack? yes
# - Include stack pack? nextjs (or your stack)

# 2. Sync to agents
aligntrue sync

# 3. Start coding
cursor .
```

**What happened:**

- Created `.aligntrue/rules.md` with base rules
- Pulled `base-global` and `nextjs` packs from catalog
- Exported to `.cursor/rules/` and `AGENTS.md`
- Auto-pull enabled (pulls updates on sync)

**Next steps:**

- Customize test command: `aligntrue plugs set test.cmd "pnpm test"`
- Adjust severity: `aligntrue override add --selector 'rule[id=...]' --set severity=warn`

### Scenario 2: Using catalog packs

**Goal:** Pull curated packs from catalog and customize for your project.

**Steps:**

```bash
# 1. Browse catalog
# Visit https://aligntrue.ai/catalog or check examples/packs.yaml

# 2. Pull pack (auto-pull enabled by default)
aligntrue sync

# 3. Audit plugs (see what needs customization)
aligntrue plugs audit

# Output:
# Slots declared:
#   test.cmd
#     Required: true
#     Status: ⚠ required
#     Example: pytest -q

# 4. Set required plugs
aligntrue plugs set test.cmd "pnpm test"

# 5. Sync with filled plugs
aligntrue sync
```

**Customization options:**

**Plugs (stack-specific values):**

```bash
aligntrue plugs set test.cmd "pnpm test"
aligntrue plugs set docs.url "https://docs.myproject.com"
```

**Overlays (severity adjustments):**

```bash
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=warn  # Downgrade from error
```

**Result:** Catalog pack customized for your project without forking.

### Scenario 3: Sharing rules across personal projects

**Goal:** Maintain consistent rules across multiple personal projects.

**Option A: Git source (recommended for personal standards)**

```bash
# 1. Create personal standards repo
mkdir my-standards
cd my-standards
git init

# 2. Create rules pack
cat > rules.yaml <<EOF
id: my-standards
version: 1.0.0
spec_version: "1"
rules:
  - id: my-custom-rule
    summary: My personal coding standard
    guidance: |
      Always do X because Y
    applies_to: ["**/*.ts"]
EOF

# 3. Commit and push
git add rules.yaml
git commit -m "Initial standards"
git remote add origin https://github.com/you/my-standards
git push -u origin main

# 4. Use in projects
cd ~/projects/project-a
aligntrue init

# Add to .aligntrue/rules.md:
sources:
  - git: https://github.com/you/my-standards
    ref: main
    path: rules.yaml

aligntrue sync
```

**Option B: Local pack (quick iteration)**

```bash
# 1. Create local pack
mkdir -p ~/.aligntrue/packs
cat > ~/.aligntrue/packs/my-standards.yaml <<EOF
id: my-standards
version: 1.0.0
spec_version: "1"
rules:
  - id: my-custom-rule
    summary: My personal coding standard
    guidance: Always do X
    applies_to: ["**/*.ts"]
EOF

# 2. Link in projects
cd ~/projects/project-a
aligntrue link ~/.aligntrue/packs/my-standards.yaml

# 3. Sync
aligntrue sync
```

**Result:** Consistent rules across all personal projects.

### Scenario 4: Customizing third-party packs

**Goal:** Use community pack but adjust for personal preferences.

**Steps:**

```bash
# 1. Pull third-party pack
# .aligntrue/rules.md:
sources:
  - git: https://github.com/community/typescript-standards
    ref: v1.0.0

# 2. Sync to see what you get
aligntrue sync

# 3. Adjust severity for personal preference
aligntrue override add \
  --selector 'rule[id=strict-null-checks]' \
  --set severity=warn  # Too strict for personal projects

# 4. Customize test command
aligntrue plugs set test.cmd "pnpm test"

# 5. Sync with customizations
aligntrue sync
```

**Result:** Community pack customized without forking.

### Scenario 5: Managing multiple stacks (monorepo)

**Goal:** Different rules for frontend vs backend in personal monorepo.

**Structure:**

```
my-monorepo/
├── apps/
│   └── web/          # Next.js
└── packages/
    └── api/          # Node.js
```

**Configuration:**

```yaml
# .aligntrue/rules.md
sources:
  - git: https://github.com/org/base-rules
    ref: v1.0.0
  - git: https://github.com/org/nextjs-rules
    ref: v1.0.0
  - git: https://github.com/org/node-rules
    ref: v1.0.0

scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-rules", "nextjs-rules"]

  - path: "packages/api"
    include: ["**/*.ts"]
    rulesets: ["base-rules", "node-rules"]

plugs:
  fills:
    test.cmd: "pnpm test"
```

**Workflow:**

```bash
# 1. Set up scopes
# (edit .aligntrue/rules.md as above)

# 2. Sync
aligntrue sync

# 3. Verify scopes
aligntrue scopes

# Output:
# apps/web: base-rules, nextjs-rules
# packages/api: base-rules, node-rules
```

**Result:** Each directory gets appropriate stack-specific rules.

## Customization patterns

### When to use plugs

**Use plugs for:**

- Test commands that vary by stack
- File paths specific to your project
- URLs, author names, project metadata

**Example:**

```bash
# Set test command
aligntrue plugs set test.cmd "pnpm test"

# Set author name
aligntrue plugs set author.name "Your Name"

# Set docs URL
aligntrue plugs set docs.url "https://docs.yourproject.com"
```

### When to use overlays

**Use overlays for:**

- Adjusting severity for personal preference
- Temporarily disabling strict rules during refactoring
- Customizing third-party packs without forking

**Example:**

```bash
# Downgrade severity during refactoring
aligntrue override add \
  --selector 'rule[id=strict-null-checks]' \
  --set severity=warn

# Disable autofix that conflicts with your workflow
aligntrue override add \
  --selector 'rule[id=prefer-const]' \
  --remove autofix
```

### When to use scopes

**Use scopes for:**

- Monorepos with multiple stacks
- Different rules for new vs legacy code
- Progressive adoption of stricter rules

**Example:**

```yaml
scopes:
  # Strict rules for new code
  - path: "src/new"
    rulesets: ["typescript-strict"]

  # Lenient rules for legacy code
  - path: "src/legacy"
    rulesets: ["typescript-lenient"]
```

## Tips and best practices

### Keep rules simple and focused

**Good:**

```yaml
rules:
  - id: test-before-commit
    summary: Run tests before committing
    guidance: Run [[plug:test.cmd]] before committing
    applies_to: ["**/*.ts"]
```

**Bad:**

```yaml
rules:
  - id: complex-rule
    summary: Do many things
    guidance: |
      Step 1: Do X
      Step 2: Do Y
      Step 3: Do Z
      Step 4: Do A
      # ... 50 more steps
```

**Why:** Simple rules are easier to understand and maintain.

### Use auto-pull for quick iteration

Auto-pull is enabled by default in solo mode:

```yaml
# .aligntrue/config.yaml
sync:
  auto_pull: true # Pulls updates on every sync
```

**Benefits:**

- Always get latest catalog packs
- No manual `aligntrue pull` needed
- Fast iteration

**Disable if:**

- You want explicit control over updates
- You're working offline

```bash
# Disable auto-pull
aligntrue config edit
# Set sync.auto_pull: false
```

### Backup before major changes

```bash
# Create backup
aligntrue backup create "before-major-refactor"

# Make changes
# ... edit rules, add overlays, etc ...

# If something breaks, restore
aligntrue backup restore "before-major-refactor"
```

### Document your decisions

Use YAML comments to explain customizations:

```yaml
overlays:
  overrides:
    # Personal preference: Warnings instead of errors during development
    # Will upgrade to error once codebase is clean
    - selector: "rule[id=strict-null-checks]"
      set:
        severity: "warn"

plugs:
  fills:
    # Using pnpm for all personal projects
    test.cmd: "pnpm test"
```

### Version control your rules

```bash
# Add to git
git add .aligntrue/
git commit -m "chore: Add AlignTrue rules"

# .gitignore (optional)
.aligntrue/.cache/        # Cache directory
.aligntrue/privacy-consent.json  # Per-machine consent
```

**What to commit:**

- `.aligntrue/rules.md` - Your rules configuration
- `.aligntrue/config.yaml` - Configuration settings
- `.cursor/rules/` - Exported Cursor rules (optional)
- `AGENTS.md` - Universal agent format (optional)

**What NOT to commit:**

- `.aligntrue/.cache/` - Cache directory
- `.aligntrue/privacy-consent.json` - Per-machine consent
- `.aligntrue.lock.json` - Only needed in team mode

## Common pitfalls and solutions

### Pitfall 1: Unresolved required plugs

**Problem:** Sync fails with "Unresolved required plugs"

**Solution:**

```bash
# 1. Audit plugs
aligntrue plugs audit

# 2. Set missing plugs
aligntrue plugs set test.cmd "pnpm test"

# 3. Sync again
aligntrue sync
```

### Pitfall 2: Too many overlays

**Problem:** Maintaining many overlays becomes tedious

**Solution:** Fork the pack or create your own:

```bash
# Instead of 20 overlays, create your own pack
mkdir my-custom-pack
cat > my-custom-pack/rules.yaml <<EOF
id: my-custom-pack
version: 1.0.0
spec_version: "1"
rules:
  # Your customized rules here
EOF

# Use your pack instead
# .aligntrue/rules.md:
sources:
  - local: ./my-custom-pack/rules.yaml
```

### Pitfall 3: Forgetting to sync after changes

**Problem:** Rules changed but agents not updated

**Solution:** Always sync after changes:

```bash
# After editing rules
aligntrue sync

# After setting plugs
aligntrue plugs set test.cmd "pnpm test"
aligntrue sync

# After adding overlays
aligntrue override add --selector '...' --set severity=warn
aligntrue sync
```

**Tip:** Create an alias:

```bash
# ~/.bashrc or ~/.zshrc
alias async='aligntrue sync'
```

### Pitfall 4: Not using version control

**Problem:** Lost rules after system crash or accidental deletion

**Solution:** Commit rules to git:

```bash
git add .aligntrue/
git commit -m "chore: Update AlignTrue rules"
```

### Pitfall 5: Overcomplicating setup

**Problem:** Spending too much time configuring instead of coding

**Solution:** Start simple:

```bash
# Minimal setup (60 seconds)
aligntrue init
aligntrue sync

# Add customizations incrementally as needed
# Don't try to perfect everything upfront
```

## Workflow examples

### Example 1: Quick project setup

```bash
# 1. Create project
mkdir my-app && cd my-app
git init

# 2. Initialize AlignTrue
aligntrue init
# Select: cursor, base-global, nextjs

# 3. Set test command
aligntrue plugs set test.cmd "pnpm test"

# 4. Sync
aligntrue sync

# 5. Start coding
cursor .
```

**Time:** 60 seconds

### Example 2: Experiment with rules

```bash
# 1. Create backup
aligntrue backup create "before-experiment"

# 2. Try different severity
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=off

# 3. Sync and test
aligntrue sync
# ... code and see how it feels ...

# 4. If you don't like it, restore
aligntrue backup restore "before-experiment"
aligntrue sync
```

### Example 3: Share rules with friend

```bash
# 1. Push rules to GitHub
git add .aligntrue/
git commit -m "Add AlignTrue rules"
git push

# 2. Friend clones and syncs
git clone https://github.com/you/my-project
cd my-project
aligntrue sync

# 3. Friend gets same rules
```

## Upgrading to team mode (optional)

If you start collaborating, upgrade to team mode:

```bash
# Enable team mode
aligntrue team enable

# Creates:
# - .aligntrue.lock.json (lockfile for reproducibility)
# - .aligntrue/allow.yaml (approved sources)

# Commit team files
git add .aligntrue.lock.json .aligntrue/allow.yaml
git commit -m "Enable AlignTrue team mode"
```

See [Team Guide](./team-guide) for team collaboration workflows.

## Related documentation

- [Customization Overview](/docs/02-customization/) - Plugs, overlays, and scopes
- [Plugs Guide](/docs/02-customization/plugs) - Stack-specific values
- [Overlays Guide](/docs/02-customization/overlays) - Rule customization
- [Scopes Guide](/docs/02-customization/scopes) - Monorepo support
- [CLI Reference](/docs/03-reference/cli-reference) - Complete command docs
- [Team Guide](./team-guide) - Upgrade to team collaboration

## Summary

**Solo developer workflow:**

1. **Quick setup** - `aligntrue init && aligntrue sync` (60 seconds)
2. **Customize** - Use plugs, overlays, and scopes as needed
3. **Iterate fast** - Auto-pull enabled, no team overhead
4. **Version control** - Commit rules to git
5. **Share easily** - Git source or local packs

**Key principles:**

- Start simple, add complexity only when needed
- Use catalog packs as starting point
- Customize with plugs, overlays, and scopes
- Document decisions with comments
- Version control your rules

**Next steps:**

- Browse [catalog](https://aligntrue.ai/catalog) for curated packs
- Read [customization guides](/docs/02-customization/) for advanced patterns
- Join community for pack sharing and support
