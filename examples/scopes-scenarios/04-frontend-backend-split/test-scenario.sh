#!/bin/bash
set -e

echo "Testing frontend-backend split scenario..."

grep -q "frontend" .aligntrue/config.yaml && echo "✓ Frontend scope"
grep -q "backend" .aligntrue/config.yaml && echo "✓ Backend scope"
grep -q "react-rules" .aligntrue/config.yaml && echo "✓ React rules for frontend"
grep -q "api-rules" .aligntrue/config.yaml && echo "✓ API rules for backend"
grep -q "security-rules" .aligntrue/config.yaml && echo "✓ Security rules"

echo ""
echo "✅ Frontend-backend split scenario validated"

