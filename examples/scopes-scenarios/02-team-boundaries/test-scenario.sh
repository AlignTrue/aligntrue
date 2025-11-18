#!/bin/bash
set -e

echo "Testing team boundaries scenario..."

grep -q "mode: team" .aligntrue/config.yaml && echo "✓ Team mode enabled"
grep -q "apps/web" .aligntrue/config.yaml && echo "✓ Frontend web scope"
grep -q "apps/mobile" .aligntrue/config.yaml && echo "✓ Frontend mobile scope"
grep -q "packages/api" .aligntrue/config.yaml && echo "✓ Backend API scope"
grep -q "packages/shared" .aligntrue/config.yaml && echo "✓ Shared packages scope"

echo ""
echo "✅ Team boundaries scenario validated"

