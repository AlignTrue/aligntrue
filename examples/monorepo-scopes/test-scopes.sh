#!/bin/bash
set -e

echo "Testing monorepo-scopes example..."

# Navigate to example directory
cd "$(dirname "$0")"

# Check required files exist
echo "✓ Checking files..."
test -f .aligntrue/config.yaml || { echo "✗ config.yaml missing"; exit 1; }
test -f .aligntrue/.rules.yaml || { echo "✗ .rules.yaml missing"; exit 1; }
test -f STRUCTURE.md || { echo "✗ STRUCTURE.md missing"; exit 1; }

# Check scope directories exist
echo "✓ Checking scope directories..."
test -d apps/web || { echo "✗ apps/web directory missing"; exit 1; }
test -d packages/api || { echo "✗ packages/api directory missing"; exit 1; }
test -d services/worker || { echo "✗ services/worker directory missing"; exit 1; }

# Check example files exist
echo "✓ Checking example files..."
test -f apps/web/src/page.tsx || { echo "✗ page.tsx missing"; exit 1; }
test -f packages/api/src/server.ts || { echo "✗ server.ts missing"; exit 1; }
test -f services/worker/main.py || { echo "✗ main.py missing"; exit 1; }

# Check scopes section exists in .rules.yaml
echo "✓ Checking scopes section..."
grep -q "scopes:" .aligntrue/.rules.yaml || { echo "✗ scopes section missing"; exit 1; }

# Count scopes (should be 3)
SCOPE_COUNT=$(grep -c 'path: "apps/web"\|path: "packages/api"\|path: "services/worker"' .aligntrue/.rules.yaml || true)
if [ "$SCOPE_COUNT" -ne 3 ]; then
    echo "✗ Expected 3 scopes, found $SCOPE_COUNT"
    exit 1
fi
echo "✓ Found 3 scopes"

# Check specific scopes exist
echo "✓ Checking scope paths..."
grep -q 'path: "apps/web"' .aligntrue/.rules.yaml || { echo "✗ apps/web scope missing"; exit 1; }
grep -q 'path: "packages/api"' .aligntrue/.rules.yaml || { echo "✗ packages/api scope missing"; exit 1; }
grep -q 'path: "services/worker"' .aligntrue/.rules.yaml || { echo "✗ services/worker scope missing"; exit 1; }

# Check scope properties
echo "✓ Checking scope properties..."
grep -q "include:" .aligntrue/.rules.yaml || { echo "✗ include patterns missing"; exit 1; }
grep -q "exclude:" .aligntrue/.rules.yaml || { echo "✗ exclude patterns missing"; exit 1; }
grep -q "rulesets:" .aligntrue/.rules.yaml || { echo "✗ rulesets missing"; exit 1; }

# Check merge configuration
echo "✓ Checking merge configuration..."
grep -q "merge:" .aligntrue/.rules.yaml || { echo "✗ merge configuration missing"; exit 1; }
grep -q 'strategy: "deep"' .aligntrue/.rules.yaml || { echo "✗ merge strategy missing"; exit 1; }

echo "✓ All scope checks passed"
echo ""
echo "To run sync and see scopes in action:"
echo "  cd examples/monorepo-scopes"
echo "  node ../../packages/cli/dist/index.js sync"
echo "  node ../../packages/cli/dist/index.js scopes"
echo ""
echo "✓ Monorepo scopes validation complete"

