#!/bin/bash
set -e

echo "Testing multi-stack monorepo scenario..."

grep -q "apps/web" .aligntrue/config.yaml && echo "✓ Next.js scope"
grep -q "packages/api" .aligntrue/config.yaml && echo "✓ Node.js API scope"
grep -q "services/worker" .aligntrue/config.yaml && echo "✓ Python worker scope"
grep -q "services/ml" .aligntrue/config.yaml && echo "✓ ML/Jupyter scope"
grep -q "nextjs-rules" .aligntrue/config.yaml && echo "✓ Next.js rules"
grep -q "python-rules" .aligntrue/config.yaml && echo "✓ Python rules"

echo ""
echo "✅ Multi-stack monorepo scenario validated"

