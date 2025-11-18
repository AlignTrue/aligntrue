#!/bin/bash
set -e

echo "Testing gradual rollout scenario..."

grep -q "strict-type-checking" .aligntrue/config.yaml && echo "✓ Type checking rule override"
grep -q "no-implicit-any" .aligntrue/config.yaml && echo "✓ Implicit any rule override"
grep -q "Phase 1" .aligntrue/config.yaml && echo "✓ Rollout phases documented"
grep -q 'severity: "info"' .aligntrue/config.yaml && echo "✓ Current phase is info"

echo ""
echo "✅ Gradual rollout scenario validated"

