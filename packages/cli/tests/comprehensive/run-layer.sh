#!/usr/bin/env bash
set -euo pipefail

# AlignTrue CLI Comprehensive Testing - Layer Runner
# Executes a single test layer in a hermetic environment

# Usage: ./run-layer.sh <layer-number>
# Example: ./run-layer.sh 1

LAYER="${1:-}"
TIMESTAMP=$(date +%s)
TEST_DIR="/tmp/aligntrue-test-${TIMESTAMP}"
LOG_FILE="${TEST_DIR}/test-output.log"
REPO_URL="${REPO_URL:-https://github.com/AlignTrue/aligntrue.git}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*" | tee -a "${LOG_FILE}"
}

error() {
  echo -e "${RED}[ERROR]${NC} $*" | tee -a "${LOG_FILE}"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "${LOG_FILE}"
}

cleanup() {
  log "Cleaning up test environment..."
  if [ -d "${TEST_DIR}" ]; then
    rm -rf "${TEST_DIR}"
    log "Test directory removed: ${TEST_DIR}"
  fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Validate layer number
if [ -z "${LAYER}" ]; then
  error "Layer number required"
  echo "Usage: $0 <layer-number>"
  echo "Layers: 1-8 or 'all'"
  exit 2
fi

if [[ ! "${LAYER}" =~ ^[1-8]$|^all$ ]]; then
  error "Invalid layer: ${LAYER}"
  echo "Valid layers: 1-8 or 'all'"
  exit 2
fi

log "Starting comprehensive test for layer: ${LAYER}"
log "Test directory: ${TEST_DIR}"

# Create test directory
mkdir -p "${TEST_DIR}"
cd "${TEST_DIR}"

# Clone repository
log "Cloning repository from ${REPO_URL}..."
if ! git clone --quiet "${REPO_URL}" aligntrue; then
  error "Failed to clone repository"
  exit 3
fi

cd aligntrue
COMMIT_HASH=$(git rev-parse HEAD)
log "Repository cloned at commit: ${COMMIT_HASH}"

# Set environment
export TZ=UTC
export NODE_ENV=test
log "Environment set: TZ=UTC, NODE_ENV=test"

# Verify Node and pnpm versions
NODE_VERSION=$(node --version)
PNPM_VERSION=$(pnpm --version)
log "Node version: ${NODE_VERSION}"
log "Pnpm version: ${PNPM_VERSION}"

# Build CLI
log "Building CLI..."
if ! pnpm --filter @aligntrue/cli build > "${TEST_DIR}/build.log" 2>&1; then
  error "Failed to build CLI"
  cat "${TEST_DIR}/build.log"
  exit 3
fi
log "CLI built successfully"

# Create test workspace
TEST_WORKSPACE="${TEST_DIR}/test-workspace"
mkdir -p "${TEST_WORKSPACE}"
cd "${TEST_WORKSPACE}"

log "Test workspace created: ${TEST_WORKSPACE}"
log "Ready to execute layer ${LAYER} tests"

# Export paths for test scripts
export ALIGNTRUE_CLI="${TEST_DIR}/aligntrue/packages/cli/dist/index.js"
export TEST_WORKSPACE="${TEST_WORKSPACE}"
export LOG_FILE="${LOG_FILE}"

# Execute layer-specific tests
LAYER_SCRIPT="${TEST_DIR}/aligntrue/packages/cli/tests/comprehensive/layers/layer-${LAYER}.ts"

if [ "${LAYER}" = "all" ]; then
  log "Executing all layers..."
  for i in {1..8}; do
    LAYER_SCRIPT="${TEST_DIR}/aligntrue/packages/cli/tests/comprehensive/layers/layer-${i}.ts"
    if [ -f "${LAYER_SCRIPT}" ]; then
      log "Executing layer ${i}..."
      node --loader tsx "${LAYER_SCRIPT}" 2>&1 | tee -a "${LOG_FILE}"
    else
      warn "Layer ${i} script not found: ${LAYER_SCRIPT}"
    fi
  done
else
  if [ -f "${LAYER_SCRIPT}" ]; then
    log "Executing layer ${LAYER}..."
    node --loader tsx "${LAYER_SCRIPT}" 2>&1 | tee -a "${LOG_FILE}"
  else
    error "Layer script not found: ${LAYER_SCRIPT}"
    exit 2
  fi
fi

log "Test execution complete"
log "Log file: ${LOG_FILE}"

# Copy log to workspace for review
WORKSPACE_LOG="${TEST_DIR}/aligntrue/.internal_docs/test-layer-${LAYER}-${TIMESTAMP}.log"
mkdir -p "$(dirname "${WORKSPACE_LOG}")"
cp "${LOG_FILE}" "${WORKSPACE_LOG}"
log "Log copied to: ${WORKSPACE_LOG}"

exit 0

