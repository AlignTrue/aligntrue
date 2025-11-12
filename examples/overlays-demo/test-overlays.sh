#!/bin/bash
set -e

echo "Testing overlays-demo example..."

# Navigate to example directory
cd "$(dirname "$0")"

# Check required files exist
echo "✓ Checking files..."
test -f .aligntrue/config.yaml || { echo "✗ config.yaml missing"; exit 1; }
test -f .aligntrue/.rules.yaml || { echo "✗ .rules.yaml missing"; exit 1; }
test -f upstream-pack.yaml || { echo "✗ upstream-pack.yaml missing"; exit 1; }
test -f SCENARIOS.md || { echo "✗ SCENARIOS.md missing"; exit 1; }

# Check overlays section exists in config.yaml
echo "✓ Checking overlays section..."
grep -q "overlays:" .aligntrue/config.yaml || { echo "✗ overlays section missing"; exit 1; }
grep -q "overrides:" .aligntrue/config.yaml || { echo "✗ overrides section missing"; exit 1; }

# Count overlays (should be 3)
OVERLAY_COUNT=$(grep -c "selector:" .aligntrue/config.yaml || true)
if [ "$OVERLAY_COUNT" -ne 3 ]; then
    echo "✗ Expected 3 overlays, found $OVERLAY_COUNT"
    exit 1
fi
echo "✓ Found 3 overlays"

# Check specific overlays exist
echo "✓ Checking overlay selectors..."
grep -q 'selector: "rule\[id=no-console-log\]"' .aligntrue/config.yaml || { echo "✗ no-console-log overlay missing"; exit 1; }
grep -q 'selector: "rule\[id=max-complexity\]"' .aligntrue/config.yaml || { echo "✗ max-complexity overlay missing"; exit 1; }
grep -q 'selector: "rule\[id=prefer-const\]"' .aligntrue/config.yaml || { echo "✗ prefer-const overlay missing"; exit 1; }

# Check overlay operations
echo "✓ Checking overlay operations..."
grep -q 'severity: "error"' .aligntrue/config.yaml || { echo "✗ severity override missing"; exit 1; }
grep -q 'threshold": 15' .aligntrue/config.yaml || { echo "✗ threshold override missing"; exit 1; }
grep -q 'remove:' .aligntrue/config.yaml || { echo "✗ remove operation missing"; exit 1; }

echo "✓ All overlay checks passed"
echo ""
echo "To run sync and see overlays in action:"
echo "  cd examples/overlays-demo"
echo "  node ../../packages/cli/dist/index.js sync"
echo ""
echo "✓ Overlays demo validation complete"

