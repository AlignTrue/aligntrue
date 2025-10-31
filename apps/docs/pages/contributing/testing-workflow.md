---
title: Testing Workflow
description: Testing standards and practices for AlignTrue contributions.
---

# Testing Workflow

AlignTrue uses Vitest for unit and integration tests. All contributions must include tests.

## Running Tests

Run all tests:

```bash
pnpm test
```

Run tests for a specific package:

```bash
pnpm --filter @aligntrue/core test
```

Watch mode:

```bash
pnpm test --watch
```

## Test Structure

Tests mirror source structure:

```
packages/core/
├── src/
│   └── bundle.ts
└── tests/
    └── bundle.test.ts
```

## Writing Tests

Follow TDD workflow:

1. Write failing test
2. Implement feature
3. Verify test passes
4. Refactor

See `.cursor/rules/tdd.mdc` for detailed TDD workflow.

## Test Quality

- Cover edge cases and error paths
- Test determinism for exports
- Use explicit assertions
- Keep tests fast (<3 minutes total suite)

## Coverage

Target 80%+ coverage for new features. Check coverage:

```bash
pnpm test --coverage
```
