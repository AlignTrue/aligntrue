#!/bin/bash
# Scenario 1: Import and sync workflow test

set -e

CLI="node ../../packages/cli/dist/index.js"
TEST_DIR="$(pwd)"

echo "=== Scenario 1: Import and sync workflow ==="

# Clean workspace
rm -rf .aligntrue .cursor AGENTS.md 2>/dev/null || true

# Create sample Cursor rules
mkdir -p .cursor/rules
cat > .cursor/rules/aligntrue.mdc <<'EOF'
# AlignTrue Test Rules

Test rules for import testing.

## Quality

Use TypeScript strict mode.

## Style

Use consistent naming conventions.
EOF

echo "✓ Created sample Cursor rules"

# Test 1: Import cursor rules (dry run)
echo ""
echo "Test 1: Import cursor (dry run)"
if $CLI import cursor 2>&1 | grep -q "Import complete"; then
    echo "✓ Import dry run succeeded"
else
    echo "✗ Import dry run failed"
    exit 1
fi

# Test 2: Import cursor rules (write)
echo ""
echo "Test 2: Import cursor (write)"
if $CLI import cursor --write 2>&1 | tee /tmp/import-output.txt; then
    if [ -f ".aligntrue/.rules.yaml" ]; then
        echo "✓ .rules.yaml created"
    else
        echo "✗ .rules.yaml not created"
        exit 1
    fi
else
    echo "✗ Import write failed"
    cat /tmp/import-output.txt
    exit 1
fi

# Test 3: Verify IR format
echo ""
echo "Test 3: Verify IR format"
if grep -q "spec_version:" .aligntrue/.rules.yaml && \
   grep -q "rules:" .aligntrue/.rules.yaml; then
    echo "✓ IR format valid"
else
    echo "✗ IR format invalid"
    cat .aligntrue/.rules.yaml
    exit 1
fi

echo ""
echo "=== Scenario 1: PASSED ==="

