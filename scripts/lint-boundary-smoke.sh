#!/usr/bin/env bash
set -euo pipefail

tmp_file="platform/ops-core/src/__lint_smoke__.ts"

cleanup() {
  rm -f "$tmp_file"
}

trap cleanup EXIT

cat >"$tmp_file" <<'EOF'
// Intentional violation to ensure boundary rule is enforced by ESLint.
// ops-core must not import from ops-shared.
import "../../ops-shared/google-gmail/src/index.js";
EOF

echo "Running ESLint boundary smoke test..."
if pnpm eslint "$tmp_file"; then
  echo "❌ Expected ESLint to fail for restricted import but it passed."
  exit 1
fi

echo "✅ ESLint correctly rejected forbidden import (boundary rule enforced)."

