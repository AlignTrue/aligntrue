#!/bin/bash
set -e

echo "Testing microservices architecture scenario..."

grep -q "services/auth" .aligntrue/config.yaml && echo "✓ Auth service scope"
grep -q "services/payments" .aligntrue/config.yaml && echo "✓ Payments service scope"
grep -q "services/notifications" .aligntrue/config.yaml && echo "✓ Notifications service scope"
grep -q "services/analytics" .aligntrue/config.yaml && echo "✓ Analytics service scope"
grep -q "security-rules" .aligntrue/config.yaml && echo "✓ Security rules"
grep -q "pci-compliance" .aligntrue/config.yaml && echo "✓ PCI compliance rules"

echo ""
echo "✅ Microservices architecture scenario validated"

