---
id: "packs/base/base-debugging"
version: "1.0.0"
summary: "Systematic debugging workflow: reproduce, reduce, root-cause, fix, prevent"
tags: ["debugging", "troubleshooting", "determinism", "paved-road"]
---

# Systematic debugging workflow

This pack establishes systematic debugging practices: reproduce deterministically, reduce to the smallest failing case, classify failures, inspect evidence, and prevent recurrence with tests.

## Debugging workflow

Follow this systematic workflow for complex debugging sessions:

1. **Reproduce deterministically** before changing code
2. **Reduce** to smallest failing case
3. **Classify** the failure type
4. **Inspect evidence**, not vibes
5. **Trace data flow** and invariants
6. **Bisect** recent changes if new
7. **Write failing test** before fixing
8. **Minimal change** that passes
9. **Clean up** and harden
10. **Validate broadly** before merge

## Reproduction scripts

**Requirement:** Non-trivial bugs require a minimal reproduction script.

Create a reproduction script showing the exact failure:

- Format: `scripts/repro*.{sh,ts,js,py}`
- Minimal and runnable
- Documents the failure condition
- Used in regression testing

## Regression prevention

**Requirement:** Bug fix PRs must include regression tests.

Before implementing the fix:

- Add a failing test that proves the bug
- Make the test pass with the fix
- Ensure test would catch this bug in future

## Temp artifact policy

Prefix AI-generated debug artifacts with `temp-`:

- Store under logs/ or local scratch
- Add to .gitignore
- Never commit
- Examples: `temp-debug-output.txt`, `temp-trace.log`, `temp-profile.json`

**Error:** Debug artifacts committed to repo without `temp-` prefix are not allowed.

## Root cause communication

In PR description, explain:

- **Root cause** - What was broken and why
- **Minimal fix** - The smallest change that resolves it
- **Prevention** - How test prevents recurrence

## Common debugging mistakes

- Changing code before reproducing
- Not reducing to minimal case
- Fixing symptoms instead of root cause
- Forgetting regression test
- Committing debug artifacts

## Tools and Techniques

- Use debuggers instead of print statements
- Bisect for finding introduction point
- Profile for performance issues
- Mock external systems deterministically
- Capture state snapshots for analysis
