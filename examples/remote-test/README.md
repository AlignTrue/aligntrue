# Remote test fixtures

This directory contains test fixtures for AlignTrue CLI integration tests. These files are copied to the `AlignTrue/examples` GitHub repository to enable deterministic testing of remote workflow and large rule set performance.

## Purpose

These fixtures enable two critical test scenarios:

1. **Personal Remote Workflow**: Testing git-based personal rules synchronization
2. **Large Rule Set Performance**: Testing CLI performance with realistic, large rule sets

## Structure

### Personal Rules

`personal-rules.md` - A realistic personal rules file containing:

- 10 sections covering typical personal coding preferences
- Valid frontmatter (id, version, spec_version)
- Realistic content about editor config, coding style, testing preferences, etc.

Used for testing:

- Remote git source configuration
- Personal rules synchronization
- Conflict detection between team and personal rules

### Large Rule Sets

`large-rules/` - A collection of 9 rule files totaling 99 sections:

| File                     | Sections | Topic                                     |
| ------------------------ | -------- | ----------------------------------------- |
| `backend-api.md`         | 14       | REST patterns, validation, error handling |
| `frontend-react.md`      | 14       | Component patterns, state, hooks          |
| `database.md`            | 10       | Migrations, queries, indexing             |
| `testing-integration.md` | 9        | Test patterns, fixtures, mocking          |
| `devops-ci.md`           | 11       | CI/CD, deployment, monitoring             |
| `code-review.md`         | 10       | Review standards, PR templates            |
| `documentation.md`       | 10       | API docs, README, architecture            |
| `performance.md`         | 10       | Profiling, optimization, caching          |
| `accessibility.md`       | 11       | WCAG, ARIA, keyboard navigation           |

**Total: 99 sections across 9 files**

This represents a comprehensive rule set that covers common development scenarios while remaining manageable for AI agents given context limits.

## Usage in Tests

### Remote Workflow Tests

Tests reference the GitHub repo with pinned commit hash:

```typescript
const EXAMPLES_REPO = "https://github.com/AlignTrue/examples";
const COMMIT_HASH = "abc123..."; // Pinned for determinism

// Configure source
const config = {
  sources: [
    {
      type: "git",
      url: `${EXAMPLES_REPO}@${COMMIT_HASH}`,
      path: "remote-test/personal-rules.md",
    },
  ],
};
```

### Performance Tests

Tests copy large-rules/ fixtures to test projects:

```typescript
// Copy all large rule files
await fs.cp("examples/remote-test/large-rules", join(testDir, "rules"), {
  recursive: true,
});

// Configure sources to load all files
const config = {
  sources: largeRuleFiles.map((file) => ({
    type: "local",
    path: `rules/${file}`,
  })),
};

// Measure sync performance
const startTime = Date.now();
await sync(config);
const duration = Date.now() - startTime;

// Assert performance thresholds
expect(duration).toBeLessThan(60000); // <60 seconds
```

## Maintenance

### Updating Fixtures

When updating these fixtures:

1. Make changes in this directory
2. Copy entire `remote-test/` directory to `AlignTrue/examples` repo
3. Commit and push to GitHub
4. Get the new commit hash
5. Update `COMMIT_HASH` constant in test files
6. Run tests to verify

### Adding New Fixtures

To add new test fixtures:

1. Create new file in appropriate location
2. Follow existing frontmatter format
3. Keep content realistic and meaningful
4. Update this README with file description
5. Update section count in table above
6. Copy to GitHub repo and update tests

## Performance Thresholds

Current performance expectations for large rule sets:

- **Sync time**: <60 seconds for 100-150 sections
- **Memory usage**: <500MB heap
- **File I/O**: No catastrophic slowdown with multiple files

These thresholds are tested in `packages/cli/tests/integration/performance.test.ts`.

## Related Documentation

- Test implementation: `packages/cli/tests/integration/personal-remote.test.ts`
- Performance tests: `packages/cli/tests/integration/performance.test.ts`
- Git source tests: `packages/cli/tests/integration/git-sources.test.ts`
- Testing guide: `packages/cli/tests/TESTING.md`
- CLI testing playbook: `.cursor/rules/cli_testing_playbook.mdc`
