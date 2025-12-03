---
description: Debugging workflow
apply_to: alwaysOn
content_hash: 481ce43a84eda84495d3b1096bcd14c264783a424a9838e1f6fd94f9985cfba5
---

# Debugging workflow

**When to apply:** Investigating bugs, unexpected behavior, test failures, or non-deterministic outputs. Use this before making code changes.

## Core principle

**Diagnose first, fix second.** Symptoms lie. Contracts and data flow do not.

---

## Top 5 time-wasters to avoid

1. Pattern matching fixes that "look like last time"
2. Fixing symptoms (exporter) when root cause is upstream (bundle/lock/schema)
3. Assuming examples and quickstarts are correct
4. Ignoring environment drift (TZ, Node, OS, CI)
5. Trial and error edits without a hypothesis

If you catch any of these: stop and read the error literally.

---

## Investigation framework

### 1. Read the error literally

```
UndefinedError: 'object' has no property 'contentHash'
```

Extract facts:

- Type: object
- Missing: contentHash
- Suspect: shape/contract mismatch

Ask: Why is the key missing? Not "How do I access it differently?"

### 2. Trace the data flow

Map source → transforms → destination.

```
load config → resolve packs → bundle → build context → exporter (error)
↑
Likely fix lives here
```

Answer:

1. Where does the data originate?
2. What transforms it?
3. What does the consumer expect?
4. Where do actual vs expected diverge?

### 3. Inspect actual state

Do not guess. Log the real shape. Remove logs before commit.

```typescript
const log = (o: unknown) => {
  console.debug("type:", Array.isArray(o) ? "array" : typeof o);
  try {
    console.debug("preview:", JSON.stringify(o, null, 2).slice(0, 2000));
  } catch {}
};
log(ctx);
```

### 4. Compare expected vs actual

```typescript
// Expected
const expected = { contentHash: "sha256:...", rules: [] };

// Actual
const actual = {
  hash: "sha256:...",
  rules: [],
  meta: { contentHash: "sha256:..." },
};
// Root cause: contentHash nested under meta instead of top level
```

Fix the transformation or normalization, not templates or call sites that already match the contract.

### 5. Identify the root cause

Keep asking "why" until you hit a contract boundary:

- Symptom: exporter missing contentHash
- Why: context builder never flattened metadata
- Why: bundle layout changed, normalization not updated
- Root cause: missing normalization step
- Fix: add normalization in shared context builder

### 6. Fix at the right layer

Use this matrix:

| Situation                                | Fix location               | Reason                |
| ---------------------------------------- | -------------------------- | --------------------- |
| Nested vs flat mismatch across consumers | Normalization/shared layer | One source of truth   |
| One consumer needs special format        | That consumer              | Localize special case |
| Shared contract used by many             | Shared helpers             | Consistency and DRY   |

### 7. Verify the fix

Prove the contract, do not just silence the error.

```typescript
expect(ctx.contentHash).toMatch(/^sha256:/);
expect(bytes(exportMdc(ctx))).toStrictEqual(bytes(exportMdc(ctx)));
```

Checklist:

- Error is gone
- Root cause understood and documented
- Correct layer changed
- Contract test added to prevent regression

---

## Common anti-patterns

- "Fix and see" loops
- Copying old fixes based on similar messages
- Only reproducing via full system runs (no minimal repro)
- Treating docs/examples as ground truth without verifying
- Token churning: repeated edits without fixing the underlying contract

If you see this pattern, reset to the investigation framework above.

---

## CI Failures

For troubleshooting CI issues, always follow the guidance in `.cursor/rules/ci_troubleshooting.mdc` to conserve API rate limits.

Key command: `pnpm ci:errors`

---

## Git safety

Always stash before destructive operations.

```bash
git stash push -m "WIP: <desc>"
git checkout <branch>   # or git switch/reset
# ... investigate ...
git stash pop
```

Never:

- Run git checkout or git reset with uncommitted changes without stashing
- Assume uncommitted work is recoverable

If you did it anyway:

1. `git reflog`
2. `git stash list`
3. `git fsck --lost-found`
4. If still lost, rebuild. Prevention is cheaper.

---

## Recognizing and stopping token churning

Churning = burning tokens on repeated edits without fixing the underlying contract.

Warning signs:

1. Same type of tweak 3+ times in a row
2. Bulk search/replace before proving pattern
3. Editing tests to match outputs instead of fixing behavior
4. Fighting mocks instead of understanding code under test
5. Huge token use, small actual progress

Reset with three questions:

1. What pattern am I repeating?
2. What is the actual contract or behavior?
3. Which single layer is wrong?

Then:

1. Fix one representative case end to end
2. Confirm with tests
3. Apply the proven pattern once across the rest

---

## Environment checks

Run these early:

```bash
TZ=UTC pnpm test

node -v
pnpm -v

# Canonical diff
jq -S . out1.json > a && jq -S . out2.json > b && diff -u a b || true

# Nondeterminism scan
rg "Date\.now|Math\.random|performance\.now" packages/schema/src packages/cli/src packages/core/src
```

---

## OS-specific behavior

Before touching code, check if the failure is platform specific.

Common differences:

| Area         | Unix           | Windows          | Strategy             |
| ------------ | -------------- | ---------------- | -------------------- |
| Permissions  | chmod reliable | chmod unreliable | Skip or branch tests |
| Spawn time   | Faster         | Slower           | Higher thresholds    |
| Paths        | `/`            | `\`              | Use path.\* helpers  |
| Line endings | `\n`           | `\r\n`           | Normalize in tests   |
| Temp dirs    | `/tmp`         | `C:\...`         | Use os.tmpdir()      |

If CI fails only on Windows:

- Read error literally
- Check for assumptions about paths, chmod, timing
- Decide: real bug vs platform specific test
- Fix once at correct layer

---

## Minimal repro pattern

Use tight, focused tests.

```typescript
test("context exposes contentHash at top level", () => {
  const merged = { rules: [], meta: { contentHash: "sha256:abc" } };
  const ctx = normalizeContext(merged);
  expect(ctx.contentHash).toBe("sha256:abc");
});
```

Run:

```bash
pnpm --filter @aligntrue/schema vitest run packages/schema/tests/context.contract.test.ts -t contentHash -v
```

---

## Logging guidelines

- Log what happened and how to fix it
- Do not log secrets or token-like values
- Prefer structured logs behind `--json` when helpful
- Strip debug logs before merge

---

## AlignTrue quick reference

| Error pattern                    | First check            | Likely cause        | Fix location                                      |
| -------------------------------- | ---------------------- | ------------------- | ------------------------------------------------- |
| Lockfile bytes differ            | canonicalizeJson usage | Missing JCS or sort | packages/schema/src/canonicalize.ts               |
| Missing or wrong exporter footer | Context contentHash    | Not flattened       | packages/cli/src/commands/sync/context-builder.ts |
| aligntrue --help slow            | Import graph           | Eager imports       | packages/cli/src/commands/\*.ts                   |
| Pass local, fail CI              | TZ/Node drift          | Env mismatch        | Vitest setup, CI config                           |
| Scope mismatch on Windows        | Path normalization     | Slash handling      | packages/core/src/scope.ts                        |
| Ajv errors unreadable            | Error shaping          | Missing formatter   | packages/core/src/validation/\*.ts                |

---

## Determinism triage

```bash
# 1. Canonical compare
jq -S . bundle1.json > b1 && jq -S . bundle2.json > b2 && diff -u b1 b2 || true

# 2. Nondeterminism search
rg "Date\.now|Math\.random|performance\.now" packages/schema/src packages/cli/src packages/core/src

# 3. Stable sets
# Ensure set-like arrays are sorted once in canonicalization
```

---

## Temp artifacts

All temporary debug artifacts must start with `temp-`.
Never commit temp files.

---

## Communicate the fix

In PR or commit message:

- Root cause in one sentence
- What changed and where
- How tests now enforce the contract
- Any platform or determinism notes

---

# Error Lessons Learned Reference

- For troubleshooting complex or recurring errors, consult `.cursor/rules/error_lessons_learned.mdc`—it contains past solutions and root causes.
- When you solve a tricky or non-obvious error, summarize the problem, root cause, and successful fix in `error_lessons_learned.mdc`.
- Write entries in a clear, concise, and structured way (e.g., Symptoms → Cause → Resolution) to help both humans and AI tools diagnose similar issues in the future.
