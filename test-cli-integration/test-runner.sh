#!/bin/bash
# Comprehensive CLI integration test runner

set -e

CLI="node ../packages/cli/dist/index.js"
FINDINGS_FILE="findings.md"

# Initialize findings file
cat > "$FINDINGS_FILE" <<'EOF'
# AlignTrue CLI Integration Test Findings

Test execution date: $(date)

EOF

run_scenario() {
    local name="$1"
    local dir="$2"
    
    echo ""
    echo "==============================================="
    echo "=== $name ==="
    echo "==============================================="
    
    if cd "$dir" && ./test.sh 2>&1 | tee -a "../$FINDINGS_FILE"; then
        echo "✓ $name PASSED" | tee -a "../$FINDINGS_FILE"
        cd ..
        return 0
    else
        echo "✗ $name FAILED" | tee -a "../$FINDINGS_FILE"
        cd ..
        return 1
    fi
}

echo "=== AlignTrue CLI Integration Tests ==="
echo "Using CLI: $CLI"
echo ""

# Track results
TOTAL=0
PASSED=0
FAILED=0

# Run Scenario 1: Import and sync
if [ -d "scenario-1-import" ] && [ -f "scenario-1-import/test.sh" ]; then
    TOTAL=$((TOTAL + 1))
    if run_scenario "Scenario 1: Import and sync" "scenario-1-import"; then
        PASSED=$((PASSED + 1))
    else
        FAILED=$((FAILED + 1))
    fi
fi

# Summary
echo "" | tee -a "$FINDINGS_FILE"
echo "===============================================" | tee -a "$FINDINGS_FILE"
echo "=== Test Summary ===" | tee -a "$FINDINGS_FILE"
echo "===============================================" | tee -a "$FINDINGS_FILE"
echo "Total scenarios: $TOTAL" | tee -a "$FINDINGS_FILE"
echo "Passed: $PASSED" | tee -a "$FINDINGS_FILE"
echo "Failed: $FAILED" | tee -a "$FINDINGS_FILE"
echo "" | tee -a "$FINDINGS_FILE"

if [ $FAILED -eq 0 ]; then
    echo "✓ All tests passed!" | tee -a "$FINDINGS_FILE"
    exit 0
else
    echo "✗ Some tests failed. Review findings.md for details." | tee -a "$FINDINGS_FILE"
    exit 1
fi

