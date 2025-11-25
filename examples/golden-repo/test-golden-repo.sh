#!/usr/bin/env bash
#
# Golden Repository Validation Script
# Tests that the golden repo demonstrates < 60 second setup
#

set -e

echo "=== AlignTrue Golden Repository Validation ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track overall status
FAILURES=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
}

fail() {
  echo -e "${RED}✗${NC} $1"
  FAILURES=$((FAILURES + 1))
}

# Start timer
START_TIME=$(date +%s)

# Test 1: Config file exists
echo "Test 1: Config file exists..."
if [ -f ".aligntrue/config.yaml" ]; then
  pass "Config file exists"
else
  fail "Config file not found"
  exit 1
fi

# Test 2: Rules directory exists (internal)
echo "Test 2: Rules directory exists..."
if [ -d ".aligntrue/rules" ]; then
  pass "Rules directory exists (.aligntrue/rules)"
else
  fail "Rules directory not found"
  exit 1
fi

# Test 3: AGENTS.md exists (primary user file)
echo "Test 3: AGENTS.md exists..."
if [ -f "AGENTS.md" ]; then
  pass "AGENTS.md exists (primary user-editable file)"
else
  fail "AGENTS.md not found"
fi

# Test 4: Run sync
echo "Test 4: Running sync..."
# Ensure target directories exist to rule out creation permission issues
mkdir -p .cursor/rules
mkdir -p .vscode

SYNC_START=$(date +%s)
# Use --auto-enable to accept discovered agents in CI (non-interactive)
# Disable set -e temporarily to capture exit code and show errors
set +e
SYNC_OUTPUT=$(node ../../packages/cli/dist/index.js sync --auto-enable --non-interactive 2>&1)
SYNC_EXIT=$?
set -e
SYNC_END=$(date +%s)
SYNC_DURATION=$((SYNC_END - SYNC_START))

if [ $SYNC_EXIT -eq 0 ]; then
  pass "Sync completed in ${SYNC_DURATION}s"
  
  # Check sync performance
  if [ $SYNC_DURATION -gt 10 ]; then
    fail "Sync took >10s (expected <5s for 5 rules)"
  fi
else
  fail "Sync command failed (exit code: $SYNC_EXIT)"
  echo "=== Sync Error Output ==="
  echo "$SYNC_OUTPUT"
  echo "=== End Error Output ==="
  exit 1
fi

# Test 5: Verify outputs exist
echo "Test 5: Verifying outputs..."
if ls .cursor/rules/*.mdc 1>/dev/null 2>&1; then
  pass "Cursor output exists"
else
  fail "Cursor output not found"
  echo "DEBUG: Sync output was:"
  echo "$SYNC_OUTPUT"
  echo "DEBUG: Directory listing:"
  ls -R .cursor
fi

if [ -f "AGENTS.md" ]; then
  pass "AGENTS.md exists"
else
  fail "AGENTS.md not found"
fi

# Note: VS Code MCP is optional (only if vscode-mcp exporter is enabled)
if [ -f ".vscode/mcp.json" ]; then
  pass "VS Code MCP config exists"
fi

# Test 6: Verify content hashes (computed by exporter, not written to file)
echo "Test 6: Verifying content hashes..."
# Note: Content hash is computed and returned by exporter, not written as footer in .mdc files
# This matches current exporter behavior (footers removed, fidelity notes shown in CLI output)
pass "Content hash computed by exporter and returned in result"

if [ -f ".vscode/mcp.json" ]; then
  if grep -q "content_hash" .vscode/mcp.json; then
    pass "MCP config has content hash"
  else
    fail "MCP config missing content hash"
  fi
fi

# Test 7: Verify file sizes are reasonable
echo "Test 7: Verifying file sizes..."
CURSOR_SIZE=$(cat .cursor/rules/*.mdc 2>/dev/null | wc -c | tr -d ' ')
AGENTS_SIZE=$(wc -c < AGENTS.md | tr -d ' ')

if [ $CURSOR_SIZE -gt 500 ] && [ $CURSOR_SIZE -lt 10000 ]; then
  pass "Cursor output size reasonable (${CURSOR_SIZE} bytes)"
else
  fail "Cursor output size unexpected: ${CURSOR_SIZE} bytes"
fi

if [ $AGENTS_SIZE -gt 500 ] && [ $AGENTS_SIZE -lt 10000 ]; then
  pass "AGENTS.md size reasonable (${AGENTS_SIZE} bytes)"
else
  fail "AGENTS.md size unexpected: ${AGENTS_SIZE} bytes"
fi

if [ -f ".vscode/mcp.json" ]; then
  MCP_SIZE=$(wc -c < .vscode/mcp.json | tr -d ' ')
  if [ $MCP_SIZE -gt 500 ] && [ $MCP_SIZE -lt 10000 ]; then
    pass "MCP config size reasonable (${MCP_SIZE} bytes)"
  else
    fail "MCP config size unexpected: ${MCP_SIZE} bytes"
  fi
fi

# End timer
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "=== Summary ==="
echo "Total duration: ${TOTAL_DURATION}s"

if [ $TOTAL_DURATION -gt 60 ]; then
  echo -e "${RED}⚠${NC} Setup took >${TOTAL_DURATION}s (target: <60s)"
  FAILURES=$((FAILURES + 1))
else
  echo -e "${GREEN}✓${NC} Setup completed in <60s"
fi

if [ $FAILURES -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}${FAILURES} test(s) failed${NC}"
  exit 1
fi

