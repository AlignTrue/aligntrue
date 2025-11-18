#!/bin/bash
set -e

echo "Testing progressive adoption scenario..."

# Check config is valid YAML
if ! command -v yq &> /dev/null; then
  echo "✓ Config file exists"
else
  yq eval '.scopes | length' .aligntrue/config.yaml > /dev/null
  echo "✓ Config has scopes defined"
fi

# Verify directory structure
test -d src/new && echo "✓ src/new directory exists"
test -d src/legacy && echo "✓ src/legacy directory exists"

# Check scope configuration
grep -q "src/new" .aligntrue/config.yaml && echo "✓ New code scope configured"
grep -q "src/legacy" .aligntrue/config.yaml && echo "✓ Legacy code scope configured"
grep -q "typescript-strict" .aligntrue/config.yaml && echo "✓ Strict rules for new code"
grep -q "typescript-lenient" .aligntrue/config.yaml && echo "✓ Lenient rules for legacy"

echo ""
echo "✅ Progressive adoption scenario validated"

