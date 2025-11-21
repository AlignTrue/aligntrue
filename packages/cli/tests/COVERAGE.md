# CLI Test Coverage Matrix

This document tracks test coverage for all CLI commands and features.

## Test Scripts

### Local Build Testing

**Script:** `pnpm test:local`  
**Location:** `tests/scripts/test-local-build.sh`

This script ensures we always test the local build, not an outdated npm package:

1. Builds all packages from source (`pnpm build`)
2. Creates isolated test environment in `/tmp`
3. Uses local CLI binary (not npm)
4. Runs smoke tests (init, check, config commands)
5. Generates structured report in `.internal_docs/TEST_LOG_LOCAL.md`
6. Cleans up automatically

**Usage:**

```bash
cd packages/cli
pnpm test:local
```

**When to use:**

- Before releasing new versions
- After making changes to core sync logic
- When comprehensive tests report false positives
- To validate fixes work in the actual built CLI

### Comprehensive Testing

**Script:** `pnpm test:comprehensive`  
**Location:** `tests/comprehensive/run-all-layers.ts`

Runs all 8 test layers from the CLI testing playbook. See `.cursor/rules/cli_testing_playbook.mdc` for details.

## Commands (27 total)

| Command   | Happy Path | Error Cases | Exit Codes | Help Text | Integration Tests |
| --------- | ---------- | ----------- | ---------- | --------- | ----------------- |
| init      | ✅         | ✅          | ✅         | ✅        | ✅                |
| sync      | ✅         | ⚠️          | ✅         | ✅        | ✅                |
| watch     | ⚠️         | ⚠️          | ✅         | ✅        | ✅                |
| check     | ✅         | ✅          | ✅         | ✅        | ✅                |
| team      | ✅         | ⚠️          | ✅         | ✅        | ✅                |
| drift     | ✅         | ⚠️          | ✅         | ✅        | ✅                |
| backup    | ✅         | ⚠️          | ✅         | ✅        | ✅                |
| revert    | ✅         | ⚠️          | ✅         | ✅        | ✅                |
| adapters  | ✅         | ⚠️          | ✅         | ✅        | ⚠️                |
| config    | ✅         | ⚠️          | ✅         | ✅        | ⚠️                |
| plugs     | ⚠️         | ⚠️          | ✅         | ✅        | ❌                |
| scopes    | ⚠️         | ⚠️          | ✅         | ✅        | ❌                |
| pull      | ⚠️         | ⚠️          | ✅         | ✅        | ⚠️                |
| link      | ⚠️         | ⚠️          | ✅         | ✅        | ⚠️                |
| md        | ⚠️         | ⚠️          | ✅         | ✅        | ❌                |
| migrate   | ⚠️         | ⚠️          | ✅         | ✅        | ❌                |
| onboard   | ⚠️         | ⚠️          | ✅         | ✅        | ❌                |
| override  | ⚠️         | ⚠️          | ✅         | ✅        | ✅                |
| privacy   | ✅         | ⚠️          | ✅         | ✅        | ⚠️                |
| telemetry | ✅         | ⚠️          | ✅         | ✅        | ⚠️                |
| update    | ⚠️         | ⚠️          | ✅         | ✅        | ❌                |
| sources   | ⚠️         | ⚠️          | ✅         | ✅        | ❌                |

**Legend:**

- ✅ Fully tested
- ⚠️ Partially tested
- ❌ Not tested

## Features

| Feature             | Unit Tests | Integration Tests | E2E Tests | Notes                      |
| ------------------- | ---------- | ----------------- | --------- | -------------------------- |
| Two-way sync        | ✅         | ✅                | ⚠️        | Core functionality works   |
| Lockfile generation | ✅         | ✅                | ⚠️        | Team mode tested           |
| Drift detection     | ✅         | ✅                | ⚠️        | Multiple modes tested      |
| Allow lists         | ✅         | ✅                | ⚠️        | Validation works           |
| Backup/restore      | ✅         | ✅                | ❌        | Basic workflows tested     |
| Git sources         | ⚠️         | ✅                | ❌        | Local repos tested         |
| Vendored packs      | ⚠️         | ✅                | ❌        | Structure detection works  |
| Overlays            | ✅         | ✅                | ✅        | Configuration validated    |
| Watch mode          | ⚠️         | ✅                | ❌        | Auto-sync tested           |
| Exporters (51)      | ⚠️         | ✅                | ❌        | Smoke tests added          |
| Idempotency         | ✅         | ✅                | ❌        | Byte-identical outputs     |
| Scopes              | ✅         | ✅                | ✅        | Monorepo scenarios tested  |
| Plugs               | ✅         | ✅                | ✅        | Slot/fill system validated |
| Combined features   | ✅         | ✅                | ✅        | All three together tested  |

## Test Files

### Unit Tests

- `packages/core/tests/**/*.test.ts` - Core functionality
- `packages/schema/tests/**/*.test.ts` - Schema validation
- `packages/exporters/tests/**/*.test.ts` - Exporter logic

### Integration Tests

- `packages/cli/tests/integration/exporters-smoke.test.ts` - All exporters (derived from packages/exporters/src)
- `packages/cli/tests/integration/idempotency.test.ts` - Deterministic outputs
- `packages/cli/tests/integration/backup.test.ts` - Backup/restore workflows
- `packages/cli/tests/integration/git-sources.test.ts` - Git operations
- `packages/cli/tests/integration/overlays.test.ts` - Overlay configuration validation
- `packages/cli/tests/integration/scopes-monorepo.test.ts` - Scopes for monorepos
- `packages/cli/tests/integration/plugs-resolution.test.ts` - Plugs slot/fill system
- `packages/cli/tests/integration/customization-combined.test.ts` - All features together
- `packages/cli/tests/integration/watch.test.ts` - Watch mode
- `packages/cli/tests/integration/check-command.test.ts` - Check command
- `packages/cli/tests/integration/init-command.test.ts` - Init command

## Coverage Gaps

### High Priority

1. **Migration wizards** - Solo→team, team→solo transitions
2. **Remote git sources** - Only local repos tested so far

### Medium Priority

5. **All command error paths** - Many commands only have happy path tests
6. **Cross-platform** - Full test suite runs on Ubuntu and macOS; Windows has limited coverage (13 integration tests skip)
7. **Performance** - No benchmarks or stress tests
8. **Concurrent operations** - Race conditions not tested

### Low Priority

9. **Edge cases** - Unusual configurations and inputs
10. **Telemetry** - Opt-in/opt-out flows
11. **Update checks** - Version comparison logic

## Running Tests

### All tests

```bash
pnpm test
```

### Specific package

```bash
pnpm --filter @aligntrue/cli test
pnpm --filter @aligntrue/core test
```

### Integration tests only

```bash
pnpm --filter @aligntrue/cli test:integration
```

### Watch mode

```bash
pnpm --filter @aligntrue/cli test:watch
```

## Test Standards

### Unit Tests

- Fast (< 100ms per test)
- Isolated (no file I/O, no network)
- Deterministic (same input → same output)
- Clear assertions (one concept per test)

### Integration Tests

- Use hermetic test directories (`temp-test-*`)
- Clean up after themselves
- Test real CLI commands
- Verify actual file outputs

### E2E Tests (Future)

- Test complete user workflows
- Use real git repositories
- Verify cross-tool compatibility
- Run in CI on multiple platforms

## Maintenance

### Adding New Tests

1. Create test file in appropriate directory
2. Follow existing patterns and naming
3. Add to this coverage matrix
4. Update relevant documentation

### Fixing Flaky Tests

1. Identify root cause (timing, state, environment)
2. Add retries or better synchronization
3. Document known issues
4. Consider marking as `.skip` if unfixable

### Removing Tests

1. Document why in commit message
2. Update coverage matrix
3. Add TODO for replacement if needed
