#!/usr/bin/env bash

#
# Distribution Simulation Script
#
# This script simulates the npm distribution experience by:
# 1. Creating a tarball with pnpm align
# 2. Extracting and rewriting workspace:* to concrete versions
# 3. Setting up proper module resolution
# 4. Running smoke tests
#
# Why: pnpm link --global doesn't work with workspace:* dependencies
# This properly tests what users get when they npm install -g @aligntrue/cli
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Detect script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$CLI_DIR/../.." && pwd)"

# Test directory
TEST_DIR="/tmp/aligntrue-distribution-test-$(date +%s)"
EXTRACT_DIR="$TEST_DIR/package"
DIST_DIR="$TEST_DIR/dist-simulation"

# Cleanup function
cleanup() {
    if [ -d "$TEST_DIR" ]; then
        log_info "Cleaning up test directory: $TEST_DIR"
        rm -rf "$TEST_DIR"
    fi
    
    # Clean up tarball from CLI directory
    if [ -f "$CLI_DIR"/aligntrue-cli-*.tgz ]; then
        rm -f "$CLI_DIR"/aligntrue-cli-*.tgz
    fi
}

# Register cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    echo "======================================"
    echo "  AlignTrue Distribution Test"
    echo "======================================"
    echo ""
    
    log_info "Workspace root: $REPO_ROOT"
    log_info "CLI directory: $CLI_DIR"
    echo ""
    
    # Step 1: Verify all packages are built
    log_info "Step 1: Verifying packages are built..."
    
    if [ ! -d "$REPO_ROOT/packages/core/dist" ]; then
        log_error "Core package not built. Run: cd $REPO_ROOT && pnpm build"
        exit 1
    fi
    
    if [ ! -d "$CLI_DIR/dist" ]; then
        log_error "CLI not built. Run: cd $REPO_ROOT && pnpm build"
        exit 1
    fi
    
    log_success "All packages are built"
    echo ""
    
    # Step 2: Create tarball
    log_info "Step 2: Creating distribution tarball..."
    cd "$CLI_DIR"
    
    # Clean up old tarballs first
    rm -f aligntrue-cli-*.tgz
    
    if ! pnpm align --align-destination "$CLI_DIR" >/dev/null 2>&1; then
        log_error "Failed to create tarball"
        exit 1
    fi
    
    TARBALL=$(ls aligntrue-cli-*.tgz 2>/dev/null | head -1)
    if [ -z "$TARBALL" ]; then
        log_error "Tarball not found after pnpm align"
        exit 1
    fi
    
    VERSION=$(echo "$TARBALL" | sed 's/aligntrue-cli-\(.*\)\.tgz/\1/')
    log_success "Created tarball: $TARBALL (version $VERSION)"
    echo ""
    
    # Step 3: Extract tarball
    log_info "Step 3: Extracting tarball..."
    mkdir -p "$EXTRACT_DIR"
    cd "$EXTRACT_DIR"
    
    if ! tar -xzf "$CLI_DIR/$TARBALL" 2>/dev/null; then
        log_error "Failed to extract tarball"
        exit 1
    fi
    
    # Move package contents up one level
    mv package/* .
    rmdir package 2>/dev/null || true
    
    log_success "Extracted tarball to $EXTRACT_DIR"
    echo ""
    
    # Step 4: Rewrite workspace:* to concrete versions
    log_info "Step 4: Rewriting workspace:* dependencies..."
    
    # Read current version from package.json
    PACKAGE_JSON="$EXTRACT_DIR/package.json"
    
    # Rewrite workspace:* to ^$VERSION for all @aligntrue/* dependencies
    # This simulates what pnpm publish does automatically
    sed -i.bak \
        -e "s|\"@aligntrue/\\([^\"]*\\)\": \"workspace:\\*\"|\"@aligntrue/\\1\": \"^$VERSION\"|g" \
        "$PACKAGE_JSON"
    
    rm -f "$PACKAGE_JSON.bak"
    
    # Verify rewrite worked
    if grep -q "workspace:\*" "$PACKAGE_JSON"; then
        log_error "Failed to rewrite all workspace:* dependencies"
        grep "workspace:" "$PACKAGE_JSON"
        exit 1
    fi
    
    log_success "Rewrote workspace:* to ^$VERSION"
    echo ""
    
    # Step 5: Set up distribution simulation
    log_info "Step 5: Setting up distribution simulation..."
    mkdir -p "$DIST_DIR"
    
    # Copy CLI package to dist simulation
    cp -r "$EXTRACT_DIR"/* "$DIST_DIR/"
    
    # Create node_modules with actual workspace packages
    # In real npm install, these would be downloaded from npm registry
    # For testing, we symlink to the built workspace packages
    mkdir -p "$DIST_DIR/node_modules/@aligntrue"
    
    for pkg in core exporters file-utils plugin-contracts schema sources; do
        PKG_DIR="$REPO_ROOT/packages/$pkg"
        if [ -d "$PKG_DIR/dist" ]; then
            ln -s "$PKG_DIR" "$DIST_DIR/node_modules/@aligntrue/$pkg"
        fi
    done
    
    # Install other dependencies (non-workspace)
    # Use pnpm install but with --no-lockfile to avoid workspace resolution
    cd "$DIST_DIR"
    log_info "Installing non-workspace dependencies..."
    if ! pnpm install --no-lockfile --prod >/dev/null 2>&1; then
        log_error "Failed to install dependencies"
        exit 1
    fi
    
    # Restore workspace package symlinks (they might have been overwritten)
    for pkg in core exporters file-utils plugin-contracts schema sources; do
        PKG_DIR="$REPO_ROOT/packages/$pkg"
        if [ -d "$PKG_DIR/dist" ]; then
            rm -rf "node_modules/@aligntrue/$pkg"
            ln -s "$PKG_DIR" "node_modules/@aligntrue/$pkg"
        fi
    done
    
    log_success "Distribution simulation ready at $DIST_DIR"
    echo ""
    
    # Step 6: Run smoke tests
    log_info "Step 6: Running smoke tests..."
    echo ""
    
    CLI_BINARY="$DIST_DIR/dist/index.js"
    chmod +x "$CLI_BINARY"
    
    # Make binary executable with proper shebang if needed
    if ! head -1 "$CLI_BINARY" | grep -q "^#!"; then
        # Prepend shebang
        echo "#!/usr/bin/env node" | cat - "$CLI_BINARY" > "$CLI_BINARY.tmp"
        mv "$CLI_BINARY.tmp" "$CLI_BINARY"
        chmod +x "$CLI_BINARY"
    fi
    
    # Test 1: --version
    log_info "Test: --version"
    if VERSION_OUTPUT=$("$CLI_BINARY" --version 2>&1); then
        log_success "--version: $VERSION_OUTPUT"
    else
        log_error "--version failed"
        echo "$VERSION_OUTPUT"
        exit 1
    fi
    echo ""
    
    # Test 2: --help (with timing)
    log_info "Test: --help (should be <1s)"
    START_TIME=$(date +%s%N)
    if "$CLI_BINARY" --help >/dev/null 2>&1; then
        END_TIME=$(date +%s%N)
        DURATION=$(( (END_TIME - START_TIME) / 1000000 ))
        log_success "--help: ${DURATION}ms"
        
        if [ $DURATION -gt 1000 ]; then
            log_warn "Help command took ${DURATION}ms (expected <1000ms)"
        fi
    else
        log_error "--help failed"
        exit 1
    fi
    echo ""
    
    # Test 3: init in clean directory
    log_info "Test: init --yes in clean directory"
    TEST_PROJECT="$TEST_DIR/test-project"
    mkdir -p "$TEST_PROJECT"
    cd "$TEST_PROJECT"
    
    if "$CLI_BINARY" init --yes >/dev/null 2>&1; then
        log_success "init: created project"
        
        # Verify files were created
        if [ -f ".aligntrue/config.yaml" ] && [ -d ".aligntrue/rules" ]; then
            log_success "init: config and rules directory created"
        else
            log_error "init: missing expected files"
            exit 1
        fi
    else
        log_error "init failed"
        exit 1
    fi
    echo ""
    
    # Test 4: status command
    log_info "Test: status"
    if "$CLI_BINARY" status >/dev/null 2>&1; then
        log_success "status: works"
    else
        log_error "status failed"
        exit 1
    fi
    echo ""
    
    # Test 5: check command (no config)
    log_info "Test: check in directory without config"
    NO_CONFIG_DIR="$TEST_DIR/no-config"
    mkdir -p "$NO_CONFIG_DIR"
    cd "$NO_CONFIG_DIR"
    
    # check should fail gracefully (exit 2) when no config exists
    if "$CLI_BINARY" check 2>/dev/null; then
        log_warn "check: expected error for missing config, but succeeded"
    else
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 2 ]; then
            log_success "check: correctly reported missing config (exit $EXIT_CODE)"
        else
            log_warn "check: exited with code $EXIT_CODE (expected 2)"
        fi
    fi
    echo ""
    
    # Summary
    echo "======================================"
    echo "  Distribution Test Summary"
    echo "======================================"
    echo ""
    log_success "All smoke tests passed"
    log_info "Tarball: $TARBALL"
    log_info "Simulated distribution at: $DIST_DIR"
    echo ""
    log_info "The distribution simulation successfully tests the CLI"
    log_info "as users would experience it with npm install -g"
    echo ""
}

# Run main function
main "$@"

