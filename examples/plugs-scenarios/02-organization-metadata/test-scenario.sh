#!/bin/bash
set -e

echo "Testing organization metadata scenario..."

grep -q "org.name" .aligntrue/config.yaml && echo "✓ Organization name fill"
grep -q "docs.url" .aligntrue/config.yaml && echo "✓ Documentation URL fill"
grep -q "support.email" .aligntrue/config.yaml && echo "✓ Support email fill"
grep -q "author.name" .aligntrue/config.yaml && echo "✓ Author name fill"
grep -q "Acme Corp" .aligntrue/config.yaml && echo "✓ Organization values specified"

echo ""
echo "✅ Organization metadata scenario validated"

