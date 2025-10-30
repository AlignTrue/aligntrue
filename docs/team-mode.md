# Team mode

Comprehensive guide to using AlignTrue in team environments with approved rule sources, lockfiles, and drift detection.

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

### 2. Create allow list

```bash
aligntrue team approve sha256:abc123...
```

This creates `.aligntrue/allow.yaml` with approved rule sources.

### 3. Sync with validation

```bash
aligntrue sync
```

Team mode validates all sources against the allow list before syncing.

## Allow list

### What is an allow list?

The allow list (`.aligntrue/allow.yaml`) specifies which rule sources your team has approved. In team mode, sync operations validate sources against this list.

### File format

`.aligntrue/allow.yaml`:

```yaml
version: 1
sources:
  - type: id
    value: base-global@aligntrue/catalog@v1.0.0
    resolved_hash: sha256:abc123...
    comment: Official base rules
  - type: hash
    value: sha256:def456...
    comment: Vendored custom pack
```

### Source formats

#### ID@version format

Format: `id@profile@version`

Example: `base-global@aligntrue/catalog@v1.0.0`

**Pros:**

- Semantic and readable
- Can update version references
- Clear provenance

**Cons:**

- Requires resolution (git clone or catalog lookup)
- Network dependency

**Best for:** External sources, catalog packs, shared repositories

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
  base-global@aligntrue/catalog@v1.0.0 \
  sha256:def456...

# Approve with ID@version (resolves to hash)
aligntrue team approve custom-pack@myorg/rules@v2.1.0
```

**What it does:**

1. Parses source format
2. Resolves ID@version to concrete hash (Phase 3: git only, Phase 4: catalog first)
3. Adds to `.aligntrue/allow.yaml`
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

1.  base-global@aligntrue/catalog@v1.0.0
    → sha256:abc123...

2.  sha256:def456...
    # Vendored pack

Total: 2 sources
```

### `aligntrue team remove`

Remove source(s) from allow list.

```bash
# Remove by ID
aligntrue team remove base-global@aligntrue/catalog@v1.0.0

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
aligntrue team approve base-global@aligntrue/catalog@v1.0.0

# 3. Sync to generate lockfile
aligntrue sync

# 4. Commit team files
git add .aligntrue/config.yaml .aligntrue/allow.yaml .aligntrue.lock.json
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
git add .aligntrue/allow.yaml .aligntrue.lock.json
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
git add .aligntrue/config.yaml .aligntrue/allow.yaml .aligntrue.lock.json
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
   cat .aligntrue/allow.yaml
   ```

2. Fix syntax or restore from git:

   ```bash
   git checkout .aligntrue/allow.yaml
   ```

3. Re-approve sources via CLI (safer than manual edits)

## ID@version vs hash tradeoffs

### When to use ID@version

✅ **Use for:**

- Catalog packs (Phase 4)
- Shared git repositories
- Public/well-known sources
- When you want semantic versioning

❌ **Avoid for:**

- Offline environments
- Vendored/submoduled sources
- When immutability is critical

**Example:**

```bash
aligntrue team approve base-global@aligntrue/catalog@v1.0.0
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

## Severity remapping

Control how rule severities are enforced in your team environment while maintaining audit trails and policy guardrails.

### Overview

Severity remapping allows teams to adjust rule enforcement levels without modifying source packs. Common use cases:

- **Staged rollout:** Start with warnings before enforcing errors
- **Temporary exceptions:** Downgrade errors during migration periods
- **Custom policy:** Align enforcement with team standards

**Guardrails:** Lowering `MUST` rules to `info` requires documented rationale to prevent policy regression.

### Configuration

Create `.aligntrue.team.yaml` in your repo root:

```yaml
severity_remaps:
  - rule_id: "security/no-eval"
    from: "MUST"
    to: "warn"
    rationale_file: "docs/rationale/eval-exception.md"

  - rule_id: "style/semicolons"
    from: "SHOULD"
    to: "note"
```

### Severity mapping

AlignTrue uses human-readable severities that map to check levels:

| Source severity | Check level | Behavior              |
| --------------- | ----------- | --------------------- |
| `MUST`          | `error`     | Fail checks, block CI |
| `SHOULD`        | `warn`      | Log warning, continue |
| `MAY`           | `note`      | Informational only    |

Remapping allows you to override the source severity for specific rules.

### Rationale requirement

**Policy regression guardrail:** Lowering `MUST` rules to `note` (info) requires a rationale file.

Example rationale (`docs/rationale/eval-exception.md`):

```markdown
# Rationale: Downgrade security/no-eval to warning

**Issue:** #1234
**Owner:** @security-team  
**Date:** 2025-10-30
**Review:** 2025-12-01

## Context

Legacy analytics code uses eval in controlled sandbox contexts. Refactoring will take 2-3 months.

## Plan

Migrate to safer alternatives by Q1 2026:

- Phase 1: Audit all eval usage (complete)
- Phase 2: Replace with Function constructor (Dec 2025)
- Phase 3: Remove eval entirely (Jan 2026)

## Approval

Security team approved temporary downgrade with documented migration plan and quarterly reviews.

## Monitoring

Track remaining eval usage with custom lint rule: `@org/no-legacy-eval`
```

**Required fields:**

- Issue link
- Owner contact
- Review date
- Migration plan
- Approval record

### Drift detection

Changes to `.aligntrue.team.yaml` are detected by drift detection:

```bash
aligntrue drift
```

Output:

```
SEVERITY_REMAP DRIFT:
  security/no-eval
    Team policy changed (hash mismatch)
    Suggestion: Run aligntrue sync to update lockfile
```

The lockfile tracks `team_yaml_hash` to detect policy changes.

### Example workflows

**Staged rollout:**

```yaml
# Week 1: Introduce as notes
severity_remaps:
  - rule_id: "typescript/strict-null-checks"
    from: "MUST"
    to: "note"

# Week 4: Upgrade to warnings
severity_remaps:
  - rule_id: "typescript/strict-null-checks"
    from: "MUST"
    to: "warn"

# Week 8: Remove remap (enforce as error)
severity_remaps: []
```

**Temporary exception:**

```yaml
severity_remaps:
  - rule_id: "deprecated/lodash-v3"
    from: "MUST"
    to: "warn"
    rationale_file: "docs/rationale/lodash-migration.md"
```

Set calendar reminder to remove after migration completes.

### Troubleshooting

**Rationale file missing:**

```
Error: MUST->note remap requires rationale
Rule: security/no-eval
Missing: docs/rationale/eval-exception.md
```

**Fix:** Create rationale file with required fields.

**Drift detected after remap:**

```
SEVERITY_REMAP DRIFT:
  Team policy changed
```

**Fix:** Run `aligntrue sync` to update lockfile with new team_yaml_hash.

**Remap not applied:**

```
Expected: warn
Got: error
```

**Fix:** Verify rule_id matches exactly (case-sensitive). Run `aligntrue check --verbose` to see active remaps.

## Advanced topics

### Phase 3.5 prep (optional base_hash field)

The lockfile includes an optional `base_hash` field to prepare for Phase 3.5 overlay resolution:

```json
{
  "version": "1",
  "sources": [
    {
      "type": "catalog",
      "id": "base-global",
      "version": "v1.0.0",
      "hash": "sha256:abc...",
      "base_hash": "sha256:def..."
    }
  ]
}
```

**Current behavior (Phase 3):** Field is captured when available but not used for resolution.

**Future behavior (Phase 3.5):** Enables overlay resolution for local modifications atop base packs.

### Private/vendored pack workflows

See [Git Workflows](git-workflows.md) for:

- Git submodule setup
- Git subtree setup
- Vendored pack integrity validation

### Catalog resolution (Phase 4)

When the catalog launches (Phase 4), ID@version resolution will:

1. Try catalog API first (fast, no clone)
2. Fall back to git if catalog unavailable
3. Store both ID and hash in allow list

## See also

- [Commands Reference](commands.md) - All CLI commands
- [Quickstart Guide](quickstart.md) - Getting started
- [Drift Detection](drift-detection.md) - Coming in Session 6
- [Git Workflows](git-workflows.md) - Coming in Session 4
