#!/bin/bash
# AlignTrue pre-commit hook
# Validates team mode invariants before commit

# Only run in team mode
MODE=$(aligntrue config get mode 2>/dev/null || echo "solo")

if [ "$MODE" != "team" ]; then
  exit 0
fi

# Run validation
aligntrue check --pre-commit

if [ $? -ne 0 ]; then
  echo ""
  echo "✗ AlignTrue validation failed"
  echo "  Fix the issues above or bypass with:"
  echo "  git commit --no-verify"
  exit 1
fi

exit 0

