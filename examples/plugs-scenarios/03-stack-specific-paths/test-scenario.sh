#!/bin/bash
set -e

echo "Testing stack-specific paths scenario..."

grep -q "config.file" .aligntrue/config.yaml && echo "✓ Config file path fill"
grep -q "env.file" .aligntrue/config.yaml && echo "✓ Environment file path fill"
grep -q "build.output" .aligntrue/config.yaml && echo "✓ Build output path fill"
grep -q "next.config.js" .aligntrue/config.yaml && echo "✓ Next.js specific paths"

echo ""
echo "✅ Stack-specific paths scenario validated"

