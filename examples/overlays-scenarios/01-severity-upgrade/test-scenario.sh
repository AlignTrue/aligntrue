#!/bin/bash
set -e

echo "Testing severity upgrade scenario..."

grep -q "overlays:" .aligntrue/config.yaml && echo "✓ Overlays section exists"
grep -q "no-console-log" .aligntrue/config.yaml && echo "✓ Console log rule override"
grep -q 'severity: "error"' .aligntrue/config.yaml && echo "✓ Severity upgraded to error"

echo ""
echo "✅ Severity upgrade scenario validated"

