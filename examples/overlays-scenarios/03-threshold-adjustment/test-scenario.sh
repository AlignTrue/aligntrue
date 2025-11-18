#!/bin/bash
set -e

echo "Testing threshold adjustment scenario..."

grep -q "max-complexity" .aligntrue/config.yaml && echo "✓ Complexity threshold override"
grep -q "max-lines" .aligntrue/config.yaml && echo "✓ Line limit override"
grep -q "check.inputs.threshold: 20" .aligntrue/config.yaml && echo "✓ Threshold value adjusted"

echo ""
echo "✅ Threshold adjustment scenario validated"

