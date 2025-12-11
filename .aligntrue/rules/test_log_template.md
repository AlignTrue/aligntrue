---
description: Use this template for documenting test runs.
content_hash: 4baf2c1d5f7be283a09f4390fe2a15f0978441fa60272d9115fe8c907f4d7394
---

# Test run template

Use this template for documenting test runs.

## Test run {YYYY-MM-DD HH:MM}

**Environment:**

- Commit: {git commit hash}
- Node: {node --version}
- Platform: {darwin|linux|win32}
- Test Type: {local|ci|manual}

**Test Execution:**

- Code Source: {local workspace|remote commit}
- Environment: {hermetic|workspace}
- Test Directory: {path to test dir}

---

## Findings

### Confirmed bugs

#### [P0] {Bug Title}

**Description:** {What's broken}

**Root cause:** {Why it's broken}

**Reproduction:**

```bash
# Steps to reproduce
```

**Fix:** {How to fix it}

**Files affected:**

- `{file path}`
- `{file path}`

---

#### [P1] {Bug Title}

{Same structure as P0}

---

### Test execution issues

#### {Issue Title}

**What went wrong:** {Description of test setup/execution problem}

**Impact:** {Did this invalidate test results?}

**How to fix:** {For next test run}

---

### Coverage gaps

#### {Gap Title}

**What wasn't tested:** {Description}

**Why:** {Reason - time, complexity, dependencies, etc.}

**Plan:** {When/how to test this}

---

## Summary

**Bugs found:** {count} ({P0 count} P0, {P1 count} P1, {P2 count} P2)

**Tests passed:** {count}/{total}

**Coverage:** {percentage or description}

**Release readiness:** {Ready|Blocked|Needs work}

**Blockers:**

- {List any P0 bugs blocking release}

**Next steps:**

1. {Action item}
2. {Action item}
3. {Action item}
