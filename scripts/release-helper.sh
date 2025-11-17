#!/usr/bin/env bash

# Lightweight helper to bump, build, and publish AlignTrue packages
# Usage: ./scripts/release-helper.sh [patch|minor|major]

set -euo pipefail

BUMP_TYPE="${1:-patch}"

case "${BUMP_TYPE}" in
  patch|minor|major)
    ;;
  *)
    echo "Error: bump type must be one of patch, minor, major" >&2
    exit 1
    ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

PACKAGES=(
  schema
  file-utils
  plugin-contracts
  testkit
  core
  sources
  exporters
  cli
  aligntrue
)

echo "==> Bumping package versions (${BUMP_TYPE})"
for pkg in "${PACKAGES[@]}"; do
  pkg_dir="packages/${pkg}"
  if [[ ! -d "${pkg_dir}" ]]; then
    echo "Skipping missing directory: ${pkg_dir}"
    continue
  fi

  echo "  $(basename "${pkg_dir}")"
  (
    cd "${pkg_dir}"
    old_version="$(node -p 'require("./package.json").version')"
    npm version "${BUMP_TYPE}" --no-git-tag-version >/dev/null
    new_version="$(node -p 'require("./package.json").version')"
    echo "    ${old_version} → ${new_version}"
  )
done

echo ""
echo "==> Building packages"
pnpm build:packages

echo ""
echo "==> Publishing packages to npm (tag: latest)"
for pkg in "${PACKAGES[@]}"; do
  pkg_dir="packages/${pkg}"
  if [[ ! -d "${pkg_dir}" ]]; then
    continue
  fi

  echo "  Publishing ${pkg_dir}"
  (
    cd "${pkg_dir}"
    npm publish --tag latest
  )
done

cat <<'EOF'

✅ Publish complete!

Next steps:
  1. pnpm install
  2. git add -A
  3. git commit -m "chore: Release vX.Y.Z"
  4. git tag vX.Y.Z
  5. git push origin main --tags

Remember to update CHANGELOG.md before tagging.
EOF
