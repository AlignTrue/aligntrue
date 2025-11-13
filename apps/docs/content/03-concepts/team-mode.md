# Team mode

Comprehensive reference for team mode concepts and configuration.

> **Looking for step-by-step team setup?** See the [Team Guide](/docs/01-guides/05-team-guide) for practical workflows.

## Overview

Team mode enables collaborative rule management with:

- **Lockfiles** for reproducible rule deployment
- **Allow lists** for approved rule sources
- **Drift detection** for alignment monitoring
- **Git-based workflows** for rule sharing

## Team mode vs solo mode

| Feature               | Solo mode | Team mode |
| --------------------- | --------- | --------- |
| Lockfile generation   | ❌        | ✅        |
| Bundle generation     | ❌        | ✅        |
| Allow list validation | ❌        | ✅        |
| Drift detection       | ❌        | ✅        |
| Auto-pull             | ✅        | ❌        |

## Quick start

### 1. Enable team mode

```bash
aligntrue team enable
```

This updates `.aligntrue/config.yaml`:

- `mode: solo` → `mode: team`
- Enables `modules.lockfile` and `modules.bundle`

### 2. Generate lockfile

```bash
aligntrue sync
```

This generates `.aligntrue.lock.json` with deterministic bundle hash.

### Lockfile with sections

Lockfiles track section fingerprints for natural markdown packs:

```json
{
  "rules": [
    {
      "rule_id": "fp:code-quality-a1b2c3", // Section fingerprint
      "content_hash": "sha256:...",
      "source": "..."
    }
  ]
}
```

For rule-based packs, `rule_id` contains the explicit rule ID. For section-based packs, it contains the section fingerprint (prefixed with `fp:`).

Section fingerprints are stable identifiers generated from the heading and content, allowing lockfiles to track changes to natural markdown sections without requiring explicit IDs.

### 3. Create allow list

```bash
aligntrue team approve --current
```

This creates `.aligntrue.allow` and approves your current bundle hash.

### 4. Sync with validation

```bash
aligntrue sync
```

Team mode validates bundle hash against the allow list before syncing.

## Allow list

### What is an allow list?

The allow list (`.aligntrue.allow`) specifies which rule sources your team has approved. In team mode, sync operations validate sources against this list.

### File format

`.aligntrue.allow`:

```yaml
version: 1
sources:
  - type: git
    value: https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml
    resolved_hash: sha256:abc123...
    comment: Official base rules
  - type: hash
    value: sha256:def456...
    comment: Vendored custom pack
```

### Source formats

#### Git URL format

Format: `git:URL`

Example: `git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml`

**Pros:**

- Semantic and readable
- Direct URL reference
- Works with any git repository

**Cons:**

- Requires resolution (git clone)
- Network dependency

**Best for:** External sources, example packs, shared repositories

#### Hash format

Format: `sha256:...`

Example: `sha256:abc123def456...`

**Pros:**

- Immutable and deterministic
- No resolution needed
- Works offline

**Cons:**

- Hard to audit (what is this hash?)
- Can't update without changing hash

**Best for:** Vendored packs, local sources, submodules

### Recommendation

- **External sources:** Use `id@version` format for clarity and semantic updates
- **Vendored packs:** Use `sha256:hash` format for immutability

## Allow list management

### Quick approve current bundle

```bash
# After sync, approve what you have
aligntrue team approve --current
```

This reads the bundle hash from `.aligntrue.lock.json` and adds it to the allow list.

### Manual approve by hash

```bash
# Approve specific bundle hash
aligntrue team approve sha256:abc123...
```

### Enforcement

In team mode with an allow list:

- Sync validates bundle hash against allow list
- Unapproved bundles are rejected
- Use `--force` to bypass (not recommended)

### First-time setup

When you first enable team mode:

1. Run `aligntrue sync` to generate lockfile
2. Run `aligntrue team approve --current` to approve it
3. Commit both files to git
4. Team members clone and sync normally

## CLI commands

### `aligntrue team enable`

Enable team mode in current repository.

```bash
aligntrue team enable
```

Interactive confirmation, then updates config.

### `aligntrue team approve`

Add source(s) to allow list.

```bash
# Approve single source
aligntrue team approve sha256:abc123...

# Approve multiple sources
aligntrue team approve \
  git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml \
  sha256:def456...

# Approve with ID@version (resolves to hash)
aligntrue team approve custom-pack@myorg/rules@v2.1.0
```

**What it does:**

1. Parses source format
2. Resolves ID@version to concrete hash
3. Adds to `.aligntrue.allow`
4. Shows resolved hash

**Interactive mode:** If resolution fails, prompts to continue with remaining sources.

### `aligntrue team list-allowed`

Show approved sources.

```bash
aligntrue team list-allowed
```

**Output:**

```
Approved rule sources:

1.  git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml
    → sha256:abc123...

2.  sha256:def456...
    # Vendored pack

Total: 2 sources
```

### `aligntrue team remove`

Remove source(s) from allow list.

```bash
# Remove by git URL
aligntrue team remove git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml

# Remove by hash
aligntrue team remove sha256:abc123...
```

**Interactive confirmation:** Prompts before removing each source (default: no).

### `aligntrue sync --force`

Bypass allow list validation.

```bash
aligntrue sync --force
```

**Use with caution:** Only for emergencies or testing. Logs warning.

## Workflows

### Initial team setup

**Repository owner:**

```bash
# 1. Enable team mode
aligntrue team enable

# 2. Approve team sources
aligntrue team approve git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml

# 3. Sync to generate lockfile
aligntrue sync

# 4. Commit team files
git add .aligntrue/config.yaml .aligntrue.allow .aligntrue.lock.json
git commit -m "Enable AlignTrue team mode"
git push
```

**Team members:**

```bash
# 1. Clone repository
git clone <repo>
cd <repo>

# 2. Sync (validated against allow list)
aligntrue sync
```

### Approving new sources

When adding a new rule source:

```bash
# 1. Approve source
aligntrue team approve new-pack@vendor/rules@v1.0.0

# 2. Update config to use new source
# Edit .aligntrue/config.yaml, add to sources array

# 3. Sync
aligntrue sync

# 4. Commit allow list and lockfile
git add .aligntrue.allow .aligntrue.lock.json
git commit -m "Add new rule source: new-pack"
git push
```

### Reviewing approved sources

```bash
# List all approved sources
aligntrue team list-allowed

# Check lockfile for actual sources in use
cat .aligntrue.lock.json | jq '.sources'
```

### Removing sources

```bash
# 1. Remove from config first
# Edit .aligntrue/config.yaml, remove from sources array

# 2. Sync to update lockfile
aligntrue sync

# 3. Remove from allow list
aligntrue team remove old-pack@vendor/rules@v1.0.0

# 4. Commit
git add .aligntrue/config.yaml .aligntrue.allow .aligntrue.lock.json
git commit -m "Remove old rule source"
git push
```

### Handling unapproved source errors

**Error:**

```
✗ Unapproved sources in team mode:
  - custom-pack@example/org@v1.0.0

To approve sources:
  aligntrue team approve <source>

Or bypass this check (not recommended):
  aligntrue sync --force
```

**Resolution:**

1. **Intended source:** Approve it

   ```bash
   aligntrue team approve custom-pack@example/org@v1.0.0
   ```

2. **Testing/emergency:** Use --force (logs warning)

   ```bash
   aligntrue sync --force
   ```

3. **Unknown source:** Review config, remove or replace

## Troubleshooting

### "Source not in allow list" errors

**Cause:** Config references source not approved.

**Fix:**

```bash
# List current sources
aligntrue team list-allowed

# Approve missing source
aligntrue team approve <source>
```

### Network failures during resolution

**Cause:** ID@version resolution requires git clone.

**Fix:**

1. Use hash format instead:

   ```bash
   aligntrue team approve sha256:abc123...
   ```

2. Or ensure git access:
   ```bash
   git clone <repo-url>  # Test access
   ```

### Allow list conflicts in git

**Cause:** Multiple team members approving different sources.

**Fix:**

1. Pull latest changes
2. Review both sets of approvals
3. Keep necessary sources, remove duplicates
4. Commit merged allow list

### Invalid YAML in allow list

**Cause:** Manual edit broke YAML structure.

**Fix:**

1. Check YAML syntax:

   ```bash
   cat .aligntrue.allow
   ```

2. Fix syntax or restore from git:

   ```bash
   git checkout .aligntrue.allow
   ```

3. Re-approve sources via CLI (safer than manual edits)

## ID@version vs hash tradeoffs

### When to use ID@version

✅ **Use for:**

- Shared git repositories
- Public/well-known sources
- When you want semantic versioning

❌ **Avoid for:**

- Offline environments
- Vendored/submoduled sources
- When immutability is critical

**Example:**

```bash
aligntrue team approve git:https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml
```

### When to use hash

✅ **Use for:**

- Vendored packs (git submodule/subtree)
- Offline workflows
- Maximum immutability
- When provenance is already known

❌ **Avoid for:**

- External sources (hard to audit)
- When you need version updates

**Example:**

```bash
aligntrue team approve sha256:abc123def456...
```

## Managed sections

Team mode can designate specific sections as centrally managed, preventing local edits and ensuring team alignment.

### Overview

Managed sections protect critical rules from accidental modifications while allowing developers to add personal sections to the same file.

**Use cases:**

- Security policies that must stay consistent
- Compliance requirements
- Critical coding standards
- Shared team workflows

### Configuration

Define managed sections in `.aligntrue/config.yaml`:

```yaml
managed:
  sections:
    - "Security"
    - "Compliance"
    - "Critical Standards"
  source_url: "https://github.com/company/rules" # Optional
```

### Team-managed markers

Managed sections are marked in exported files:

**AGENTS.md:**

```markdown
<!-- 🔒 Team-managed section: Changes will be overwritten -->

## Security 🔒

All input must be validated.
```

**Cursor .mdc:**

```markdown
<!-- 🔒 Team-managed: Security -->

## Security 🔒

All input must be validated.
```

**Visual indicators:**

- 🔒 emoji in section heading
- HTML comment warning before section
- Clear attribution to team source

### Workflow

**Team members:**

1. Sync to get latest team rules: `aligntrue sync`
2. Add personal sections with different headings
3. Do not edit team-managed sections

**Example:**

```markdown
# AGENTS.md

<!-- 🔒 Team-managed section -->

## Security 🔒

Team security rules here.

## My workflow notes

Personal notes - not managed.

## Testing

Personal testing preferences - not managed.
```

**If you need to change a managed section:**

1. Create PR to team rules repository
2. Get approval from team lead
3. Team lead merges changes
4. All developers sync to get updates

### Two-way sync behavior

With two-way sync enabled (`sync.two_way: true`):

- Personal sections sync bidirectionally
- Managed sections always overwrite with team version
- Warnings shown if managed sections edited locally

**Example output:**

```bash
$ aligntrue sync
⚠ Team-managed section "Security" was modified locally
  Reverting to team version
  To keep your changes, rename the section or submit a PR to team repo
```

### Personal vs team sections

| Aspect              | Team-managed sections | Personal sections  |
| ------------------- | --------------------- | ------------------ |
| Marked with 🔒      | Yes                   | No                 |
| Local edits allowed | No (overwritten)      | Yes                |
| Syncs from agent    | No                    | Yes (two-way sync) |
| Change process      | PR to team repo       | Edit locally       |

### Example team setup

**Team repository (company/rules):**

```yaml
# aligntrue.yaml
sections:
  - heading: "Security"
    content: |
      ## Security

      1. Validate all input
      2. Use parameterized queries
      3. Never log sensitive data
```

**Developer config:**

```yaml
# .aligntrue/config.yaml
sources:
  - type: git
    url: "https://github.com/company/rules"
    path: "aligntrue.yaml"

managed:
  sections:
    - "Security"
  source_url: "https://github.com/company/rules"

sync:
  two_way: true # Personal sections still sync
```

### Troubleshooting

**Section not marked as managed:**

Check:

1. Section heading matches exactly (case-sensitive)
2. `managed.sections` array in config
3. Run `aligntrue sync` to refresh

**Can't find managed section config:**

```bash
aligntrue config show | grep -A5 managed
```

**Want to override a managed section:**

Options:

1. **Rename your section** - Use different heading for personal version
2. **Disable managed mode** - Remove from `managed.sections` (solo dev only)
3. **Submit PR** - Request changes to team rules

## Advanced topics

### Optional base_hash field

The lockfile includes an optional `base_hash` field for advanced overlay resolution:

```json
{
  "version": "1",
  "sources": [
    {
      "type": "git",
      "url": "https://github.com/AlignTrue/aligntrue/examples/packs/global.yaml",
      "hash": "sha256:abc...",
      "base_hash": "sha256:def..."
    }
  ]
}
```

This field enables overlay resolution for local modifications atop base packs.

### Private/vendored pack workflows

See [Git Workflows](/docs/03-concepts/git-workflows) for:

- Git submodule setup
- Git subtree setup
- Vendored pack integrity validation

### Git resolution

Git source resolution:

1. Clones repository to local cache
2. Extracts specified file path
3. Stores hash in allow list for verification

## Troubleshooting

### Allow list not validated

**Symptom:** Sync succeeds even with unapproved sources in team mode.

**Cause:** Config may not be in team mode or allow list file missing.

**Fix:**

```bash
# Verify team mode enabled
aligntrue team status

# Check allow list exists
cat .aligntrue.allow

# Re-approve sources if needed
aligntrue team approve <source>
```

### Lockfile generation fails

**Symptom:** Sync creates exports but no lockfile.

**Cause:** Lockfile mode is "off" or team mode disabled.

**Fix:**

```bash
# Check lockfile configuration
grep "lockfile:" .aligntrue/config.yaml

# Enable if needed
aligntrue team enable
```

### Severity remap not applied

**Symptom:** Rules still show original severity despite `.aligntrue.team.yaml`.

**Cause:** Hash mismatch in lockfile or syntax error in team.yaml.

**Fix:**

```bash
# Check for syntax errors
cat .aligntrue.team.yaml

# Re-sync to update lockfile
aligntrue sync

# Verify drift
aligntrue drift
```

### Base hash not captured

**Symptom:** Lockfile entries missing `base_hash` field.

**Cause:** Source doesn't provide base hash metadata (expected for local sources).

**Fix:** This is expected behavior. Only git sources provide base_hash. Local sources won't have it.

## See also

- **[Commands Reference](/docs/04-reference/cli-reference)** - Complete CLI command documentation
- **[Quickstart Guide](/docs/00-getting-started/00-quickstart)** - Setup and first sync
- **[Drift Detection](/docs/03-concepts/drift-detection)** - Monitoring team alignment
- **[Auto-Updates](/docs/04-reference/auto-updates)** - Scheduled update workflows
- **[Git Workflows](/docs/03-concepts/git-workflows)** - Git-based rule sharing and vendoring
- **[Onboarding](/docs/06-contributing/team-onboarding)** - Developer onboarding checklists
- **[Examples](/docs/04-reference/examples)** - team-repo and vendored-pack examples
