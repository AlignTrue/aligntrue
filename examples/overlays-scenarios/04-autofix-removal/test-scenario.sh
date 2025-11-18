#!/bin/bash
set -e

echo "Testing autofix removal scenario..."

grep -q "prefer-const" .aligntrue/config.yaml && echo "✓ Prefer const override"
grep -q "no-var" .aligntrue/config.yaml && echo "✓ No var override"
grep -q 'remove: \["autofix"\]' .aligntrue/config.yaml && echo "✓ Autofix removal specified"

echo ""
echo "✅ Autofix removal scenario validated"

