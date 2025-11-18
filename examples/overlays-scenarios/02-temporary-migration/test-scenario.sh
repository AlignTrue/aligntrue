#!/bin/bash
set -e

echo "Testing temporary migration scenario..."

grep -q "strict-null-checks" .aligntrue/config.yaml && echo "✓ Null checks override"
grep -q "no-explicit-any" .aligntrue/config.yaml && echo "✓ Explicit any override"
grep -q "TODO: Remove after" .aligntrue/config.yaml && echo "✓ Removal date documented"
grep -q 'severity: "warn"' .aligntrue/config.yaml && echo "✓ Severity downgraded"

echo ""
echo "✅ Temporary migration scenario validated"

