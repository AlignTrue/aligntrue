---
id: "packs/base/base-testing"
version: "1.0.0"
summary: "Testing baseline: fast, deterministic, useful tests with clear strategy"
tags: ["testing", "quality", "determinism", "paved-road"]
---

# Testing baseline

This pack establishes testing standards for fast, deterministic, and useful tests. It complements the global baseline and TDD practices while deferring to security requirements.

## 5-Question Test Decision

Before adding a test:

1. Has this broken in CI or real usage?
2. Is this a public contract or critical behavior?
3. Can a unit test prove it deterministically?
4. Will it remain fast and stable?
5. Is maintenance worth it?

## Test pyramid

- **Default to unit tests** - Fast, isolated, deterministic
- **Use integration only for cross-cutting seams** - Database, API boundaries
- **Minimal e2e** - Only where system seams require it

Prefer unit over integration over e2e. Add more unit tests if pyramid is imbalanced.

## Determinism requirements

Tests must be deterministic:

- **No real network** - Use fakes or mocks
- **No filesystem side effects** - Use in-memory or temp directories
- **No clocks or randomness without fakes** - Freeze time, seed randomness
- **Stub boundaries** - Replace external systems with fakes
- **No sleeps for synchronization** - Wait on explicit conditions with timeouts

**Error:** Sleep-based synchronization (`sleep`, `setTimeout`, `time.sleep`, `Thread.sleep`) is not allowed in tests. Wait on explicit conditions with timeouts instead.

## Speed requirements

Target sub-second per test:

- **Fast tests** - Most tests should run in <100ms
- **Investigate tests >1s** - Optimize or use isolated units
- **Use local fakes** - Instead of spinning up real services

## Structure

- **Organize by type:** `tests/unit/`, `tests/integration/`, `tests/e2e/`
- **One behavioral topic per test file**
- **Name files after behavior under test:** `user-auth.test.ts`, not `test1.ts`

## Assertions

- **Prove behavior, not implementation** - Test what, not how
- **Prefer public interfaces** - Avoid testing private methods
- **Observable outcomes** - Assert on side effects and return values

## Fixtures

- **Keep small and local** - Near the tests that use them
- **Prefer builders/factories** - Over large JSON fixtures
- **Golden files only for stable outputs** - Screenshots, API responses

## External systems

- **Use fakes or emulators** - Database, queue, cache, HTTP
- **Replace real services** - testcontainers, in-memory equivalents
- **Isolate true e2e** - Keep minimal, run separately

## Flakiness

- **Don't mark flaky by default** - Fix or delete instead
- **Quarantine with issue link** - `skip("Flaky: #123")` with link
- **Short timebox** - Fix within 1-2 sprints or delete
- **Fix or delete** - Don't accumulate skipped tests

**Error:** Flaky tests without issue links are not allowed. Add issue link (`// Flaky: https://github.com/.../issues/123`) or fix/delete the test.

## Coverage

- **Enforce threshold in CI** - Typically 70-80%
- **Don't chase 100%** - Focus on critical paths and public APIs
- **Block CI on threshold miss** - If coverage drops below configured threshold

## CI Integration

- **Block on test failures** - No merge if tests fail
- **Publish test reports** - For visibility and trends
- **Fail on coverage threshold miss** - If configured

Run tests with: `pnpm test --coverage`
