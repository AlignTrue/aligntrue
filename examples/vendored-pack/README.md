# Vendored pack example

This example demonstrates vendoring rule packs with git submodule or subtree for:

- Offline access to critical rules
- Version pinning for stability
- Integrity verification
- Lockfile provenance tracking

## Vendoring strategies

### Git submodule (recommended for most teams)

**Pros:**

- Explicit version tracking
- Easy updates with `git submodule update`
- Clear dependency boundary
- Works well with monorepos

**Cons:**

- Requires git submodule commands
- Extra setup for new clones
- Can be confusing for git beginners

**Use when:** You want explicit version control and easy updates.

### Git subtree (alternative)

**Pros:**

- Simpler for contributors (just `git clone`)
- No special git commands needed
- Works with any git workflow

**Cons:**

- Updates require manual `git subtree pull`
- Harder to track upstream changes
- Can bloat git history

**Use when:** Simplicity for contributors is more important than easy updates.

## Setup workflows

### Submodule workflow

#### Initial setup

```bash
# Add organization standards as submodule
git submodule add https://github.com/org/standards vendor/org-standards

# Link vendored pack in AlignTrue
aln link git:https://github.com/org/standards vendor/org-standards

# Commit submodule
git add .gitmodules vendor/org-standards .aligntrue/config.yaml
git commit -m "chore: vendor org standards pack"
```

#### Clone with submodules

```bash
# Option 1: Clone with submodules
git clone --recurse-submodules <repo-url>

# Option 2: Clone then init submodules
git clone <repo-url>
cd <repo>
git submodule init
git submodule update
```

#### Update vendored pack

```bash
# Update to latest from upstream
cd vendor/org-standards
git pull origin main
cd ../..

# Verify changes
aln drift

# Commit update
git add vendor/org-standards
git commit -m "chore: update vendored standards to latest"
```

#### Pin to specific version

```bash
# Pin to specific commit
cd vendor/org-standards
git checkout v2.1.0  # or specific commit hash
cd ../..

# Commit pinned version
git add vendor/org-standards
git commit -m "chore: pin standards to v2.1.0"
```

### Subtree workflow

#### Initial setup

```bash
# Add organization standards as subtree
git subtree add --prefix vendor/org-standards \
  https://github.com/org/standards main --squash

# Link vendored pack in AlignTrue
aln link git:https://github.com/org/standards vendor/org-standards

# Already committed by git subtree
```

#### Update vendored pack

```bash
# Pull latest from upstream
git subtree pull --prefix vendor/org-standards \
  https://github.com/org/standards main --squash

# Verify changes
aln drift

# Already committed by git subtree
```

#### Pin to specific version

```bash
# Pull specific version
git subtree pull --prefix vendor/org-standards \
  https://github.com/org/standards v2.1.0 --squash
```

## AlignTrue integration

### Link command

The `aln link` command registers vendored packs and tracks provenance:

```bash
# Link vendored pack
aln link git:https://github.com/org/standards vendor/org-standards

# What it does:
# 1. Validates pack integrity
# 2. Adds to .aligntrue/config.yaml as local source
# 3. Updates lockfile with vendor_path and vendor_type
# 4. Enables drift detection for vendored pack
```

### Lockfile provenance

After linking, lockfile tracks vendoring details:

```json
{
  "sources": [
    {
      "type": "local",
      "path": "vendor/org-standards/rules.md",
      "vendor_path": "vendor/org-standards",
      "vendor_type": "submodule",
      "content_sha": "sha256:...",
      "resolved_at": "2025-10-30T12:30:00Z"
    }
  ]
}
```

This enables:

- **Drift detection:** `aln drift` detects changes to vendored pack
- **Integrity verification:** Lockfile hash matches pack content
- **Audit trail:** Track when and how pack was vendored

### Drift detection

Vendored packs are checked for drift:

```bash
# Detect vendored drift
aln drift

# Output if vendored pack changed:
# ⚠ Vendorized drift detected
# Source: vendor/org-standards
# Lock hash: sha256:abc123
# Current hash: sha256:def456
# Fix: Update lockfile or revert pack changes
```

## Workflows

### Scenario 1: Vendor for offline access

Team needs rules available without network access:

```bash
# Vendor pack
git submodule add https://github.com/org/standards vendor/org-standards
aln link git:https://github.com/org/standards vendor/org-standards

# Now rules work offline
aln sync  # Uses vendored pack, no network needed
```

### Scenario 2: Pin version for stability

Team wants to control when to adopt upstream changes:

```bash
# Pin to specific version
cd vendor/org-standards
git checkout v2.0.0
cd ../..
git add vendor/org-standards
git commit -m "chore: pin standards to v2.0.0"

# Update when ready
cd vendor/org-standards
git checkout v2.1.0
cd ../..
aln drift  # Shows what changed
git add vendor/org-standards
git commit -m "chore: update standards to v2.1.0"
```

### Scenario 3: Modify vendored pack locally

Team needs temporary local changes:

```bash
# Make changes
vim vendor/org-standards/rules.md

# Detect drift
aln drift
# Output: vendorized drift detected

# Options:
# 1. Revert local changes
# 2. Commit changes and track divergence
# 3. Contribute changes upstream
```

### Scenario 4: Contribute changes upstream

Improve vendored pack and share with organization:

```bash
# Make improvements locally
vim vendor/org-standards/rules.md

# Test locally
aln sync

# Create upstream PR
cd vendor/org-standards
git checkout -b improve-rules
git add rules.md
git commit -m "docs: clarify test coverage rule"
git push origin improve-rules

# Create PR on GitHub
# After merge, update submodule
git pull origin main
cd ../..
git add vendor/org-standards
git commit -m "chore: sync with upstream"
```

## Comparison: Submodule vs Subtree vs Git source

| Feature          | Submodule              | Subtree               | Git source (non-vendored) |
| ---------------- | ---------------------- | --------------------- | ------------------------- |
| Offline access   | ✅ Yes                 | ✅ Yes                | ❌ No (requires network)  |
| Version pinning  | ✅ Explicit            | ✅ Via git            | ❌ No (uses latest)       |
| Update process   | `git submodule update` | `git subtree pull`    | Automatic on sync         |
| Clone complexity | Moderate               | Simple                | Simple                    |
| Git history      | Clean                  | Can bloat             | Clean                     |
| Drift detection  | ✅ Via lockfile        | ✅ Via lockfile       | ✅ Via lockfile           |
| Best for         | Teams with git exp     | Simple contributor UX | Prototyping/experimenting |

## Files in this example

### `.aligntrue/config.yaml`

Configuration with vendored pack as local source:

```yaml
sources:
  - type: local
    path: vendor/org-standards/rules.md
```

### `.aligntrue.lock.json`

Lockfile with provenance:

```json
{
  "sources": [
    {
      "type": "local",
      "path": "vendor/org-standards/rules.md",
      "vendor_path": "vendor/org-standards",
      "vendor_type": "submodule"
    }
  ]
}
```

### `vendor/org-standards/`

Vendored pack directory (git submodule or subtree).

## Team mode with vendoring

Combine vendoring with team mode for maximum control:

```yaml
# .aligntrue/config.yaml
mode: team

sources:
  - type: local
    path: vendor/org-standards/rules.md

lockfile:
  mode: strict # Enforce vendored version
```

With team mode:

- Allow list tracks approved vendored pack
- Drift detection enforces version consistency
- Lockfile ensures deterministic builds
- CI fails on unauthorized changes

See `examples/team-repo/` for full team mode workflows.

## Troubleshooting

### Submodule not initialized

```bash
# Error: vendor/org-standards is empty
# Fix: Initialize submodules
git submodule init
git submodule update
```

### Drift detected after clean clone

```bash
# Cause: Submodule at different commit than lockfile expects
# Fix: Update submodule to match lockfile
git submodule update
```

### Can't update submodule

```bash
# Error: Detached HEAD state
# Fix: Checkout branch in submodule
cd vendor/org-standards
git checkout main
git pull origin main
cd ../..
git add vendor/org-standards
git commit -m "chore: update submodule"
```

### Subtree conflicts

```bash
# Error: Merge conflict in subtree pull
# Fix: Resolve conflicts manually
git subtree pull --prefix vendor/org-standards \
  https://github.com/org/standards main --squash
# Resolve conflicts
git add vendor/org-standards
git commit
```

## See also

- [Team mode example](../team-repo/) - Full team workflows with allow list
- [Git workflows guide](../../docs/git-workflows.md) - Pull and link commands
- [Drift detection guide](../../docs/drift-detection.md) - Drift categories including vendorized
- [Team mode guide](../../docs/team-mode.md) - Team features and best practices
