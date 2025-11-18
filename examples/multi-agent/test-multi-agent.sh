#!/bin/bash
set -e

echo "Testing multi-agent example..."

# Navigate to example directory
cd "$(dirname "$0")"

# Check required files exist
echo "✓ Checking files..."
test -f .aligntrue/config.yaml || { echo "✗ config.yaml missing"; exit 1; }
test -f .aligntrue/.rules.yaml || { echo "✗ .rules.yaml missing"; exit 1; }
test -f COMPARISON.md || { echo "✗ COMPARISON.md missing"; exit 1; }

# Check multiple exporters in config
echo "✓ Checking exporters..."
grep -q "cursor" .aligntrue/config.yaml || { echo "✗ cursor exporter missing"; exit 1; }
grep -q "agents" .aligntrue/config.yaml || { echo "✗ agents exporter missing"; exit 1; }
grep -q "github-copilot" .aligntrue/config.yaml || { echo "✗ github-copilot exporter missing"; exit 1; }
grep -q "vscode-mcp" .aligntrue/config.yaml || { echo "✗ vscode-mcp exporter missing"; exit 1; }

# Count exporters (should be 4)
EXPORTER_COUNT=$(grep -c "- cursor\|- agents\|- github-copilot\|- vscode-mcp" .aligntrue/config.yaml || true)
if [ "$EXPORTER_COUNT" -ne 4 ]; then
    echo "✗ Expected 4 exporters, found $EXPORTER_COUNT"
    exit 1
fi
echo "✓ Found 4 exporters"

# Check vendor bags exist in .rules.yaml
echo "✓ Checking vendor bags..."
grep -q "vendor:" .aligntrue/.rules.yaml || { echo "✗ vendor bags missing"; exit 1; }

# Count vendor bag instances (should be multiple)
VENDOR_COUNT=$(grep -c "vendor:" .aligntrue/.rules.yaml || true)
if [ "$VENDOR_COUNT" -lt 3 ]; then
    echo "✗ Expected multiple vendor bags, found $VENDOR_COUNT"
    exit 1
fi
echo "✓ Found $VENDOR_COUNT vendor bag instances"

# Check specific vendor namespaces
echo "✓ Checking vendor namespaces..."
grep -q "cursor:" .aligntrue/.rules.yaml || { echo "✗ cursor vendor namespace missing"; exit 1; }
grep -q "claude:" .aligntrue/.rules.yaml || { echo "✗ claude vendor namespace missing"; exit 1; }
grep -q "copilot:" .aligntrue/.rules.yaml || { echo "✗ copilot vendor namespace missing"; exit 1; }

# Check vendor bag properties
echo "✓ Checking vendor bag properties..."
grep -q "ai_hint:" .aligntrue/.rules.yaml || { echo "✗ ai_hint property missing"; exit 1; }
grep -q "quick_fix:" .aligntrue/.rules.yaml || { echo "✗ quick_fix property missing"; exit 1; }
grep -q "priority:" .aligntrue/.rules.yaml || { echo "✗ priority property missing"; exit 1; }

# Check rules exist
echo "✓ Checking rules..."
RULE_COUNT=$(grep -c "  - id: " .aligntrue/.rules.yaml || true)
if [ "$RULE_COUNT" -lt 3 ]; then
    echo "✗ Expected at least 3 rules, found $RULE_COUNT"
    exit 1
fi
echo "✓ Found $RULE_COUNT rules"

echo "✓ All multi-agent checks passed"
echo ""
echo "To run sync and see multi-agent in action:"
echo "  cd examples/multi-agent"
echo "  node ../../packages/cli/dist/index.js sync"
echo "  ls -la .cursor/rules/ AGENTS.md .github/ .vscode/"
echo ""
echo "✓ Multi-agent validation complete"

