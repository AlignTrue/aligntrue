# Team mode example repository

This example demonstrates AlignTrue team collaboration workflows with:

- Team mode configuration
- Allow list for approved rule sources
- Severity remapping with rationale
- Vendored pack with git submodule
- Lockfile with provenance tracking
- Hierarchical scopes for monorepo

## Quick setup

### 1. Enable team mode

```bash
cd examples/team-repo
aln team enable
```

This sets `mode: team` in `.aligntrue/config.yaml` and enables lockfile enforcement.

### 2. Review team configuration

```bash
# Show team status
aln team status

# List approved sources
aln team list-allowed
```

### 3. Check for drift

```bash
# Detect drift from approved sources
aln drift

# Show drift with JSON output
aln drift --json

# Fail CI on drift
aln drift --gates
```

## Team workflows

### Approve new rule source

When a team member wants to use rules from a new source:

```bash
# Pull to try before approving
aln pull git:https://github.com/org/new-rules --dry-run

# Approve after review
aln team approve git:https://github.com/org/new-rules

# Pull and sync
aln pull git:https://github.com/org/new-rules --save --sync
```

### Update to latest upstream

Check for and apply upstream rule updates:

```bash
# Check what updates are available
aln update check

# Apply updates and generate UPDATE_NOTES.md
aln update apply

# Review changes
cat UPDATE_NOTES.md
git add .
git commit -m "chore: update rules from upstream"
```

### Vendor a pack locally

For critical dependencies, vendor rules into your repository:

```bash
# Add as git submodule
git submodule add https://github.com/org/standards vendor/org-standards

# Link vendored pack
aln link git:https://github.com/org/standards vendor/org-standards

# Verify lockfile provenance
cat .aligntrue.lock.json | grep vendor_path
```

See also: `examples/vendored-pack/` for detailed vendoring workflows.

### Remap severity temporarily

When you need to temporarily lower enforcement (e.g., during migration):

```bash
# Edit .aligntrue.team.yaml
# Add severity remap with rationale_file

# Check for policy regression
aln drift

# If rationale missing, drift detection fails
```

**Guardrail:** Lowering MUST below `warn` requires `RATIONALE.md` with:

- Issue tracking link
- Justification
- Completion timeline
- Revert plan

See `.internal_docs/RATIONALE.md` for an example.

## Files explained

### `.aligntrue/config.yaml`

Team mode configuration with:

- `mode: team` - Enables team features
- `lockfile.mode: soft` - Lockfile enforcement level (off/soft/strict)
- `sources` - Rule sources (local, git, catalog)
- `exporters` - Output formats (cursor, agents-md, etc.)
- `scopes` - Hierarchical scopes for monorepo

### `.aligntrue/allow.yaml`

Approved rule sources for the team. Two formats:

1. **id@profile@version** - Resolved to hash by CLI (catalog, Phase 4)
2. **sha256:...** - Raw hash (what lockfile uses)

CLI commands automatically resolve id@version to hashes and write to lockfile.

### `.aligntrue.team.yaml`

Severity remapping for team-specific context:

- User-facing: MUST/SHOULD/MAY
- Internal: error/warn/note
- Requires rationale for policy regressions

### `.aligntrue.lock.json`

Lockfile with:

- `team_yaml_hash` - Tracks severity remap changes
- `vendor_path` / `vendor_type` - Provenance for vendored packs
- `pre_resolution_hash` / `post_resolution_hash` - Dual hashing for plugs
- `unresolved_plugs_count` - TODO tracking

### `.internal_docs/RATIONALE.md`

Policy regression justification required when lowering MUST severity.

Must include:

- Rule ID
- Change (MUST → warn/note)
- Issue tracking link
- Context and justification
- Timeline and revert plan
- Approval

### `vendor/shared-pack/`

Vendored rules directory (could be git submodule or manual copy).

## Try it yourself

### Scenario 1: Detect drift

```bash
# Make a change to shared-pack
echo "## Rule: New rule" >> vendor/shared-pack/rules.md

# Detect drift
aln drift

# Output shows: upstream drift detected
# Fix: aln update apply
```

### Scenario 2: Add new source

```bash
# Try new rules without approving
aln pull git:https://github.com/org/experimental --dry-run

# Review output, then approve
aln team approve git:https://github.com/org/experimental

# Add permanently
aln pull git:https://github.com/org/experimental --save --sync
```

### Scenario 3: Policy regression

```bash
# Edit .aligntrue.team.yaml
# Add severity remap without rationale_file

# Check drift
aln drift

# Output: policy regression detected
# Fix: Add rationale_file with RATIONALE.md
```

## CI integration

### GitHub Actions example

```yaml
name: AlignTrue Drift Check

on: [pull_request]

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @aligntrue/cli
      - run: aln drift --gates --sarif > drift.sarif
      - uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: drift.sarif
```

### GitLab CI example

```yaml
aligntrue-drift:
  stage: test
  script:
    - npm install -g @aligntrue/cli
    - aln drift --gates
  allow_failure: false
```

## Related examples

- **[Overlays demo](../overlays-demo/)** - Fork-safe customization (used in team workflows)
- **[Monorepo scopes](../monorepo-scopes/)** - Path-based rules (used in team monorepos)
- **[Multi-agent](../multi-agent/)** - Same rules, multiple agents
- **[Golden repo](../golden-repo/)** - Solo developer workflow
- **[Vendored pack](../vendored-pack/)** - Submodule vs subtree workflows

## See also

- [Team mode guide](../../docs/team-mode.md) - Complete team workflows
- [Drift detection guide](../../docs/drift-detection.md) - Drift categories and fixes
- [Auto-updates guide](../../docs/auto-updates.md) - Scheduled update workflows
- [Git workflows guide](../../docs/git-workflows.md) - Pull and link commands
