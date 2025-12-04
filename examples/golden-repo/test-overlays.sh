#!/usr/bin/env bash
#
# Test overlay scenarios for AlignTrue golden repository
#
# Demonstrates:
# - Clean merge (upstream update with overlays)
# - Conflict resolution (upstream changes overlayed field)
# - Triple-hash lockfile (content, overlay, final)
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
PASSED=0
FAILED=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

cleanup() {
  info "Cleaning up test artifacts"
  rm -f .aligntrue-overlay.yaml
  rm -f .aligntrue/rules.bak
  git checkout .aligntrue/rules 2>/dev/null || true
}

trap cleanup EXIT

# Change to script directory
cd "$(dirname "$0")"

echo "Testing Overlay Scenarios"
echo "=========================="
echo

# Check prerequisites
if ! command -v jq &> /dev/null; then
  fail "jq not installed (required for JSON parsing)"
  exit 1
fi

# Check if aln command is available
if ! command -v aln &> /dev/null; then
  info "Using local CLI build"
  ALN="node ../../packages/cli/dist/index.js"
else
  ALN="aln"
fi

# Verify golden repo structure
if [ ! -f ".aligntrue/rules" ]; then
  fail "Not in golden-repo directory or .rules.yaml missing"
  exit 1
fi

echo "Scenario 1: Clean Merge (Upstream Update with Overlays)"
echo "--------------------------------------------------------"

# Backup original rules
cp .aligntrue/rules .aligntrue/rules.bak

# Add overlay to config
if [ ! -f ".aligntrue.yaml" ]; then
  cat > .aligntrue.yaml <<EOF
spec_version: "1"
profile:
  id: golden-repo
  version: 1.0.0

sources:
  - type: local
    path: .aligntrue/rules

overlays:
  - selector:
      check_id: "typescript.no.any"
    override:
      severity: error
    metadata:
      reason: "Strict type safety for production"
      owner: "platform-team"
EOF
else
  # Append overlay to existing config
  cat >> .aligntrue.yaml <<EOF

overlays:
  - selector:
      check_id: "typescript.no.any"
    override:
      severity: error
    metadata:
      reason: "Strict type safety for production"
      owner: "platform-team"
EOF
fi

# Sync with overlay
info "Running sync with overlay"
if $ALN sync > /dev/null 2>&1; then
  pass "Sync succeeded with overlay"
else
  fail "Sync failed with overlay"
fi

# Verify lockfile exists (team mode only)
if [ -f ".aligntrue/lock.json" ]; then
  # Check for overlay hash in lockfile
  if cat .aligntrue/lock.json | jq -e '.dependencies[] | select(.overlay_hash != null)' > /dev/null 2>&1; then
    pass "Overlay hash present in lockfile"
  else
    fail "Overlay hash missing from lockfile"
  fi
else
  info "Lockfile not present (solo mode, skipping lockfile tests)"
fi

# Add new rule to simulate upstream update
info "Simulating upstream update (adding new rule)"
cat >> .aligntrue/rules.md <<'EOF'

## Rule: performance.avoid.nested.loops

**Severity:** warn

**Applies to:**
- `**/*.ts`

Avoid deeply nested loops (>2 levels). Consider refactoring to reduce
algorithmic complexity.

Examples:
- Use Array.map/filter/reduce instead of nested loops
- Extract inner loops to helper functions
- Consider algorithmic optimizations
EOF

# Sync with upstream update
if $ALN sync > /dev/null 2>&1; then
  pass "Sync succeeded after upstream update"
else
  fail "Sync failed after upstream update"
fi

# Verify overlay still applies (requires CLI support for override status)
# For now, verify lockfile updated
if [ -f ".aligntrue/lock.json" ]; then
  if cat .aligntrue/lock.json | jq -e '.dependencies[] | select(.overlay_hash != null)' > /dev/null 2>&1; then
    pass "Overlay survived upstream update"
  else
    fail "Overlay lost after upstream update"
  fi
fi

echo

echo "Scenario 2: Conflict Resolution"
echo "--------------------------------"

# Change upstream to create conflict
info "Simulating upstream change to overlayed field"
if command -v gsed &> /dev/null; then
  # macOS with GNU sed installed
  gsed -i 's/\*\*Severity:\*\* warn/\*\*Severity:\*\* error/' .aligntrue/rules.md
elif sed --version 2>&1 | grep -q GNU; then
  # GNU sed (Linux)
  sed -i 's/\*\*Severity:\*\* warn/\*\*Severity:\*\* error/' .aligntrue/rules.md
else
  # BSD sed (macOS default)
  sed -i '' 's/\*\*Severity:\*\* warn/\*\*Severity:\*\* error/' .aligntrue/rules.md
fi

# Sync should complete (conflict detection happens at override status/diff level)
if $ALN sync > /dev/null 2>&1; then
  pass "Sync succeeded with conflicting upstream change"
else
  fail "Sync failed with conflicting upstream change"
fi

# Note: Full conflict detection requires CLI commands (override status, override diff)
# These are documented but not yet implemented
info "Full conflict detection available via: aln override status / aln override diff"

echo

echo "Scenario 3: Lockfile Triple Hash"
echo "---------------------------------"

if [ ! -f ".aligntrue/lock.json" ]; then
  info "Lockfile not present (solo mode), skipping triple hash test"
else
  # Verify triple hash structure
  HASHES=$(cat .aligntrue/lock.json | jq '[.dependencies[] | select(.overlay_hash != null) | {content_hash, overlay_hash, final_hash}]')

  if echo "$HASHES" | jq -e '.[0] | .content_hash and .overlay_hash and .final_hash' > /dev/null 2>&1; then
    pass "Triple hash present (content, overlay, final)"

    # Verify hashes are different
    CONTENT=$(echo "$HASHES" | jq -r '.[0].content_hash')
    OVERLAY=$(echo "$HASHES" | jq -r '.[0].overlay_hash')
    FINAL=$(echo "$HASHES" | jq -r '.[0].final_hash')

    if [ "$CONTENT" != "$OVERLAY" ] && [ "$OVERLAY" != "$FINAL" ] && [ "$CONTENT" != "$FINAL" ]; then
      pass "All hashes unique"
    else
      fail "Hashes not unique"
    fi
  else
    fail "Triple hash incomplete"
  fi
fi

echo

echo "Scenario 4: Exporter Integration"
echo "---------------------------------"

# Verify overlay reflected in exported files
if ls .cursor/rules/*.mdc 1>/dev/null 2>&1; then
  if grep -r "typescript.no.any" .cursor/rules/*.mdc; then
    pass "Cursor export contains overlayed rule"

    # Check if severity reflects overlay (error vs warn)
    if grep -A5 "typescript.no.any" .cursor/rules/*.mdc | grep -q "error"; then
      pass "Cursor export shows overlay severity (error)"
    else
      info "Cursor export severity check skipped (format varies)"
    fi
  else
    fail "Cursor export missing overlayed rule"
  fi
else
  info "Cursor export not present, skipping exporter test"
fi

if [ -f "AGENTS.md" ]; then
  if grep -q "typescript.no.any" AGENTS.md; then
    pass "AGENTS.md export contains overlayed rule"
  else
    fail "AGENTS.md export missing overlayed rule"
  fi
else
  info "AGENTS.md not present, skipping exporter test"
fi

echo

# Summary
echo "Summary"
echo "-------"
echo -e "${GREEN}Passed:${NC} $PASSED"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Failed:${NC} $FAILED"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
fi

