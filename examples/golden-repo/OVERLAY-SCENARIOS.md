# Overlay Scenarios for Golden Repository

This document demonstrates overlay workflows using the golden repository as a base.

---

## Scenario 1: Clean Merge (Upstream Update with Overlays)

**Goal:** Demonstrate that overlays survive upstream updates when no conflicts exist.

### Setup

1. **Start with base golden repo:**

```bash
cd examples/golden-repo

# Verify initial state
cat .aligntrue/rules.md
```

2. **Add overlay to customize severity:**

```yaml
# Add to .aligntrue.yaml (or use CLI: aln override add)
overlays:
  overrides:
    - selector: "rule[id=typescript.no.any]"
      set:
        severity: "error" # Upgrade from warn to error
```

3. **Sync with overlay:**

```bash
aln sync

# Check lockfile contains overlay hash
cat .aligntrue.lock.json | jq '.dependencies[] | select(.overlay_hash != null)'
```

**Expected lockfile structure:**

```json
{
  "spec_version": "1",
  "generated_at": "2025-10-31T12:00:00Z",
  "dependencies": {
    "golden-repo-rules": {
      "version": "1.0.0",
      "source": {
        "type": "local",
        "path": ".aligntrue/rules.md"
      },
      "content_hash": "sha256:abc123...",
      "overlay_hash": "sha256:def456...",
      "final_hash": "sha256:ghi789..."
    }
  }
}
```

### Simulate Upstream Update

4. **Modify upstream rules (add new check):**

```markdown
# Add to .aligntrue/rules.md

## Rule: performance.avoid.nested.loops

**Severity:** warn

**Applies to:**

- `**/*.ts`

Avoid deeply nested loops (>2 levels). Consider refactoring to reduce
algorithmic complexity.
```

5. **Run update with overlay:**

```bash
aln sync

# Check overlay still applies
aln override status

# Expected output:
# ✓ typescript.no.any
#   Override: severity error
#   Healthy: yes
```

### Verify Clean Merge

6. **Inspect lockfile:**

```bash
# Compare hashes
git diff .aligntrue.lock.json

# New content_hash (upstream changed)
# Same overlay_hash (overlay unchanged)
# New final_hash (combined result)
```

7. **Verify exporter output:**

```bash
cat .cursor/rules/aligntrue.mdc | grep -A5 "typescript.no.any"

# Should show severity: error (from overlay)
# Should show new rule: performance.avoid.nested.loops (from upstream)
```

### Success Criteria

✅ Overlay applies after upstream update  
✅ Lockfile shows three hashes (content, overlay, final)  
✅ Exported files contain overlay modifications  
✅ No conflicts or warnings

---

## Scenario 2: Conflict Resolution (Upstream Changes Overlayed Field)

**Goal:** Demonstrate three-way merge when upstream changes same field as overlay.

### Setup

1. **Start with base golden repo:**

```bash
cd examples/golden-repo
```

2. **Add overlay:**

```yaml
# Add to .aligntrue.yaml
overlays:
  overrides:
    - selector: "rule[id=code.review.no.todos]"
      set:
        severity: "error" # Upgrade from warn
```

3. **Record original state:**

```bash
# Take snapshot of upstream
cat .aligntrue/rules.md | grep -A10 "code.review.no.todos" > /tmp/original-upstream.md

# Sync and record lockfile
aln sync
cp .aligntrue.lock.json /tmp/lockfile-with-overlay.json
```

### Simulate Conflicting Upstream Update

4. **Upstream changes same field:**

```markdown
# Update .aligntrue/rules.md

## Rule: code.review.no.todos

**Severity:** error # Changed from warn (same as overlay!)

**Applies to:**

- `**/*.ts`
- `**/*.tsx`
- `**/*.js`
- `**/*.jsx`

TODO comments should be converted to GitHub issues before merging.
They often get forgotten in the codebase.

NEW: Use --fixup mode to auto-create issues from TODOs.

Instead of: // TODO: refactor this
Do: Create issue, then // Issue #123: refactor this
```

### Detect Conflict

5. **Run sync with conflict detection:**

```bash
aln sync

# Output:
# ⚠ Overlay for code.review.no.todos is now redundant
# Upstream changed severity: warn → error
# Your overlay also sets: error
# Recommendation: Remove overlay (no longer needed)
```

6. **View three-way diff:**

```bash
aln override diff code.review.no.todos

# Output:
# ━━━ Upstream Original ━━━
# severity: warn
#
# ━━━ Upstream Current ━━━
# severity: error
# guidance: ...NEW: Use --fixup mode...
#
# ━━━ Your Overlay ━━━
# severity: error
#
# ━━━ Merged Result ━━━
# severity: error (from overlay, now matches upstream)
# guidance: ...NEW: Use --fixup mode... (from upstream)
#
# ℹ Overlay is redundant: upstream now matches your override
```

### Resolve Conflict

7. **Remove redundant overlay:**

```bash
aln override remove --check code.review.no.todos

# Output:
# ✓ Overlay removed
# Reason: Redundant (upstream now matches)
```

8. **Verify resolution:**

```bash
# Sync without overlay
aln sync

# Check lockfile (no overlay_hash for this check)
cat .aligntrue.lock.json | jq '.dependencies[]'

# Output shows only content_hash and final_hash (no overlay)
```

### Alternate Resolution: Keep Overlay with Reason

```bash
# If you want to keep override (e.g., might revert upstream later)
aln override add \
  --check code.review.no.todos \
  --severity error \
  --reason "Keep override in case upstream reverts" \
  --owner "platform-team"
```

### Success Criteria

✅ Conflict detected by sync  
✅ Three-way diff shows original, current, and overlay  
✅ Redundancy detected and reported  
✅ Overlay removed or kept with clear reason  
✅ Lockfile updated correctly

---

## Scenario 3: Overlay Update Workflow

**Goal:** Demonstrate how to update overlay when upstream adds new fields.

### Setup

1. **Start with overlay:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=typescript.no.any]"
      set:
        severity: "error"
```

### Upstream Adds New Field

2. **Upstream adds inputs:**

```markdown
## Rule: typescript.no.any

**Severity:** warn

**Inputs:**

- `allowImplicit`: false
- `allowExplicit`: false

**Applies to:**

- `**/*.ts`
- `**/*.tsx`

Avoid using 'any' type as it defeats TypeScript's type safety.
Use 'unknown' for truly unknown types, or define proper interfaces.
```

### Update Overlay

3. **Merge overlay with new upstream inputs:**

```bash
# Option A: Keep overlay simple (let upstream inputs pass through)
# No action needed - inputs merge automatically

# Option B: Customize new inputs
aln override remove 'rule[id=typescript.no.any]'
aln override add \
  --selector 'rule[id=typescript.no.any]' \
  --set severity=error \
  --set allowImplicit=false \
  --set allowExplicit=true
```

4. **Verify merge:**

```bash
aln override diff typescript.no.any

# Shows:
# - Upstream inputs (both false)
# - Your overlay (severity error, allowExplicit true)
# - Merged result (severity error, allowImplicit false, allowExplicit true)
```

### Success Criteria

✅ New upstream fields visible in diff  
✅ Overlay merges cleanly with upstream  
✅ Custom inputs override upstream defaults  
✅ Lockfile reflects merged state

---

## Scenario 4: Multi-Pack Overlay

**Goal:** Demonstrate overlays across multiple packs with same check ID.

### Setup

1. **Add second pack (simulate):**

```yaml
# .aligntrue.yaml
sources:
  - type: local
    path: .aligntrue/rules.md
  - type: local
    path: vendor/security-rules/rules.md
```

2. **Both packs have "no-secrets" check:**

```markdown
# .aligntrue/rules.md

## Rule: security.no.secrets

**Severity:** error

# vendor/security-rules/rules.md

## Rule: security.no.secrets

**Severity:** warn
```

### Apply Pack-Specific Overlays

3. **Override each pack differently:**

```yaml
overlays:
  overrides:
    # Override local pack (make more strict)
    - selector: "rule[id=security.no.secrets]"
      set:
        severity: "error"
        "check.inputs.scanComments": true

    # Override vendor pack (less strict for legacy)
    # Note: Selector applies to all rules with this ID
    # Use property paths for more granular control if needed
    - selector: "rule[id=security.no.secrets-vendor]"
      set:
        severity: "warning"
        "check.inputs.scanComments": false
```

4. **Verify pack-specific application:**

```bash
aln override status

# Output:
# ✓ golden-repo-rules → security.no.secrets (severity: error)
# ✓ security-rules → security.no.secrets (severity: warning)
```

### Success Criteria

✅ Same check ID in multiple packs  
✅ Each pack has independent overlay  
✅ Overlays don't interfere  
✅ Lockfile tracks both overlay hashes

---

## Test Script

Save as `test-overlays.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Testing Overlay Scenarios"
echo "=========================="
echo

# Scenario 1: Clean Merge
echo "Scenario 1: Clean Merge"
cd examples/golden-repo

# Add overlay
cat > .aligntrue-overlay.yaml <<EOF
overlays:
  overrides:
    - selector: 'rule[id=typescript.no.any]'
      set:
        severity: "error"
EOF

# Sync
aln sync > /dev/null

# Verify overlay hash exists
if cat .aligntrue.lock.json | jq -e '.dependencies[] | select(.overlay_hash != null)' > /dev/null; then
  echo "✓ Overlay hash present in lockfile"
else
  echo "✗ Overlay hash missing"
  exit 1
fi

# Add new rule (simulate upstream update)
cat >> .aligntrue/rules.md <<EOF

## Rule: performance.avoid.nested.loops
**Severity:** warn
**Applies to:**
- \`**/*.ts\`
EOF

# Sync with update
aln sync > /dev/null

# Verify overlay still applies
if aln override status | grep -q "typescript.no.any"; then
  echo "✓ Overlay survived upstream update"
else
  echo "✗ Overlay lost after update"
  exit 1
fi

echo

# Scenario 2: Conflict Resolution
echo "Scenario 2: Conflict Resolution"

# Add conflicting overlay
cat > .aligntrue-overlay.yaml <<EOF
overlays:
  overrides:
    - selector: 'rule[id=code.review.no.todos]'
      set:
        severity: "error"
EOF

# Sync
aln sync > /dev/null

# Change upstream (same field)
sed -i.bak 's/\*\*Severity:\*\* warn/\*\*Severity:\*\* error/' .aligntrue/rules.md

# Sync should detect redundancy
if aln sync 2>&1 | grep -q "redundant"; then
  echo "✓ Redundancy detected"
else
  echo "✗ Redundancy not detected"
  exit 1
fi

# Three-way diff shows conflict
if aln override diff code.review.no.todos | grep -q "Upstream Current"; then
  echo "✓ Three-way diff generated"
else
  echo "✗ Three-way diff failed"
  exit 1
fi

echo

# Scenario 3: Lockfile Triple Hash
echo "Scenario 3: Lockfile Triple Hash"

# Verify triple hash structure
HASHES=$(cat .aligntrue.lock.json | jq '[.dependencies[] | select(.overlay_hash != null) | {content_hash, overlay_hash, final_hash}]')

if echo "$HASHES" | jq -e '.[0] | .content_hash and .overlay_hash and .final_hash' > /dev/null; then
  echo "✓ Triple hash present (content, overlay, final)"
else
  echo "✗ Triple hash incomplete"
  exit 1
fi

# Verify hashes are different
CONTENT=$(echo "$HASHES" | jq -r '.[0].content_hash')
OVERLAY=$(echo "$HASHES" | jq -r '.[0].overlay_hash')
FINAL=$(echo "$HASHES" | jq -r '.[0].final_hash')

if [ "$CONTENT" != "$OVERLAY" ] && [ "$OVERLAY" != "$FINAL" ] && [ "$CONTENT" != "$FINAL" ]; then
  echo "✓ All hashes unique"
else
  echo "✗ Hashes not unique"
  exit 1
fi

echo
echo "All scenarios passed!"
```

Make executable:

```bash
chmod +x examples/golden-repo/test-overlays.sh
```

Run:

```bash
./examples/golden-repo/test-overlays.sh
```

---

## Expected Test Output

```
Testing Overlay Scenarios
==========================

Scenario 1: Clean Merge
✓ Overlay hash present in lockfile
✓ Overlay survived upstream update

Scenario 2: Conflict Resolution
✓ Redundancy detected
✓ Three-way diff generated

Scenario 3: Lockfile Triple Hash
✓ Triple hash present (content, overlay, final)
✓ All hashes unique

All scenarios passed!
```

---

## Integration with Golden Repo README

Add to `examples/golden-repo/README.md`:

### Overlay Demonstrations

The golden repository includes overlay scenarios demonstrating:

1. **Clean merge**: Overlays survive upstream updates
2. **Conflict resolution**: Three-way merge when upstream changes overlayed field
3. **Triple-hash lockfile**: Deterministic tracking of content, overlay, and final state

**Run overlay scenarios:**

```bash
./test-overlays.sh
```

**Learn more:** See [Overlays Guide](../../docs/overlays.md)

---

## Cleanup

After testing scenarios:

```bash
# Remove temporary overlays
rm -f .aligntrue-overlay.yaml

# Restore original rules
git checkout .aligntrue/rules.md

# Regenerate clean lockfile
aln sync
```

---

## Related Documentation

- [Overlays Guide](../../docs/overlays.md) - Complete overlay documentation
- [Drift Detection](../../docs/drift-detection.md) - Automated staleness checks
- [Commands](../../docs/commands.md) - CLI reference for overlay commands
- [Troubleshooting Overlays](../../docs/troubleshooting-overlays.md) - Common issues
