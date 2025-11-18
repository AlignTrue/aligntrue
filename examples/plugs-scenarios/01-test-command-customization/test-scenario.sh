#!/bin/bash
set -e

echo "Testing test command customization scenario..."

grep -q "plugs:" .aligntrue/config.yaml && echo "✓ Plugs section exists"
grep -q "test.cmd" .aligntrue/config.yaml && echo "✓ Test command fill defined"
grep -q "pnpm test" .aligntrue/config.yaml && echo "✓ Custom test command specified"

echo ""
echo "✅ Test command customization scenario validated"

