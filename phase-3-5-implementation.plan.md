<!-- 61105f41-2a81-4731-b370-63737ce9dbd8 3086b0d2-11b6-4b72-9f24-d1775e95851e -->

# Phase 3.5: Fork-Safe Customization (Execution Plan)

**Status:** Sessions 1-7 Complete, Sessions 8-10 Remaining  
**Total effort:** ~170k tokens (Completed: ~90k | Remaining: ~80k)  
**Scope:** Overlay foundation, documentation, CLI commands (remaining)  
**Timeline:** Pre-launch (no adoption trigger - implementing before public release)  
**Prerequisites:** Phase 3 complete ✅

## Overview

Phase 3.5 enables repos to customize upstream rules declaratively without forking. Users define overlays that apply deterministically atop upstream packs, with three-way merge support when upstream updates arrive.

**Key design principles:**

- Overlays apply to IR before export (plugs resolve at export time)
- Deterministic selector language: `rule[id=...]`, property paths, array indices
- Triple-hash lockfile format: base_hash, overlay_hash, result_hash
- Set/remove operations with dot-notation paths
- Byte-identical application across machines

## Current Stage

**Phase 3.5: Sessions 1-7 Complete** ✅  
**Status:** Documentation complete, CLI implementation remaining  
**Next:** Session 8 - CLI Commands Implementation  
**Last Updated:** 2025-10-31  
**Test Count:** 1842/1842 passing (100%)

**Progress:**

- [x] Sessions 1-2: Overlay Foundation (~25k tokens actual)
  - Config schema with validation
  - Selector parser (JSONPath subset)
  - Selector engine (exact matching, ambiguity detection)
  - Set/remove operations (flat Record with dot-notation)
  - Application algorithm (ordering, conflicts, size limits)
  - 108 tests for foundation

- [x] Session 6: Triple-Hash Lockfile (~23k tokens actual)
  - Lockfile entries: base_hash, overlay_hash, result_hash
  - Drift detection with overlay categories
  - Update command enhancement
  - 55 tests for triple-hash

- [x] Session 7: Documentation & Examples (~25k tokens actual)
  - Overlays guide (552 lines) - **Needs correction for actual schema**
  - CLI commands reference (387 lines) - **Needs correction**
  - Troubleshooting guide (401 lines) - **Needs correction**
  - Golden repo scenarios (540 lines)
  - Test script (189 lines, executable)

**Total Complete:** ~73k tokens actual, 1842 tests passing

**Remaining:**

- [ ] Session 8: Documentation Corrections & CLI Commands (~55k tokens)
- [ ] Session 9: Integration Tests (~15k tokens)
- [ ] Session 10: Golden Repo Finalization (~10k tokens)

**Total Remaining:** ~80k tokens

---

## Critical Note: Documentation vs Implementation

**Sessions 1-2 implementation** uses:

```yaml
overlays:
  overrides:
    - selector: "rule[id=check-name]" # JSONPath-style string
      set:
        severity: "error" # Flat object
        check.inputs.threshold: 15 # Dot-notation for nested
      remove: ["autofix"] # Array of keys
```

**Session 7 documentation** described aspirational format (doesn't match implementation):

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards" # Object (not implemented)
      check_id: "check-name"
    override:
      severity: error # Structured (not implemented)
```

**Session 8 will:**

1. Update documentation to match implementation
2. Implement CLI commands based on actual schema

---

## Sessions 1-2: Overlay Foundation ✅ COMPLETE

**Completed:** 2025-10-31  
**Tokens:** ~25k actual  
**Tests:** +108 tests (1842 total)

**Deliverables:**

✅ Overlay config schema (`overlays.overrides[]`)  
✅ Selector parser (`rule[id=...]`, `property.path`, `array[0]`)  
✅ Selector engine (deterministic matching)  
✅ Set/remove operations (dot-notation paths)  
✅ Application algorithm (ordering, conflicts, size limits)  
✅ Sync integration (apply overlays before export)

**Files Created:**

- `packages/core/src/overlays/types.ts`
- `packages/core/src/overlays/selector-parser.ts`
- `packages/core/src/overlays/selector-engine.ts`
- `packages/core/src/overlays/operations.ts`
- `packages/core/src/overlays/apply.ts`
- `packages/core/src/overlays/merge.ts`
- `packages/core/src/overlays/patch-writer.ts`
- `packages/core/src/overlays/validation.ts`
- `packages/core/src/overlays/index.ts`
- 8 test files with 108 tests

---

## Session 6: Triple-Hash Lockfile ✅ COMPLETE

**Completed:** 2025-10-31  
**Tokens:** ~23k actual  
**Tests:** +55 tests (1842 total)

**Deliverables:**

✅ Triple-hash lockfile format (base_hash, overlay_hash, result_hash)  
✅ Drift detection with overlay categories  
✅ Update command enhancement for base_hash  
✅ Overlay hash computation (deterministic)

**Files Modified:**

- `packages/core/src/lockfile/types.ts`
- `packages/core/src/lockfile/generator.ts`
- `packages/core/src/team/drift.ts`
- `packages/core/src/team/updates.ts`
- `packages/cli/src/commands/update.ts`

---

## Session 7: Documentation & Examples ✅ COMPLETE

**Completed:** 2025-10-31  
**Tokens:** ~25k actual  
**Tests:** No new unit tests (documentation session)

**Deliverables:**

✅ Overlays guide (552 lines) - **Needs schema correction**  
✅ CLI commands reference (387 lines) - **Needs schema correction**  
✅ Troubleshooting guide (401 lines) - **Needs schema correction**  
✅ Golden repo scenarios (351 lines)  
✅ Test script (189 lines, executable)  
✅ CHANGELOG entry

**Files Created:**

- `docs/overlays.md`
- `docs/troubleshooting-overlays.md`
- `examples/golden-repo/OVERLAY-SCENARIOS.md`
- `examples/golden-repo/test-overlays.sh`

**Files Modified:**

- `docs/commands.md` (+387 lines)
- `CHANGELOG.md`

**Known Issue:** Documentation describes aspirational format that doesn't match Sessions 1-2 implementation. Session 8 will correct this.

---

## Session 8: Documentation Corrections & CLI Commands

**Estimated:** ~55k tokens  
**Tests:** +50 tests → 1892 total  
**Target:** Fix docs, implement 4 CLI commands

### 8.1 Documentation Corrections (~5k tokens)

**Objective:** Update Session 7 docs to match actual implementation

**Files to Update:**

- `docs/overlays.md` (552 lines)
  - Replace `selector: { source_pack, check_id }` with `selector: "rule[id=...]"`
  - Replace `override: { severity, inputs }` with `set: { severity, "check.inputs.key": value }`
  - Update all YAML examples
  - Fix selector syntax throughout

- `docs/commands.md` (387 lines added)
  - Update command examples to use actual flags
  - Fix selector format in examples
  - Update expected output examples

- `docs/troubleshooting-overlays.md` (401 lines)
  - Fix selector examples
  - Update resolution steps with correct syntax
  - Fix all code snippets

**Changes:**

Replace this pattern:

```yaml
overlays:
  - selector:
      check_id: "no-console-log"
    override:
      severity: error
```

With this pattern:

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

**Validation:** Grep docs for old patterns, ensure all updated

### 8.2 CLI Command: override add (~15k tokens)

**Objective:** Create overlays via CLI

**File:** `packages/cli/src/commands/override-add.ts`

**Flags:**

- `--selector <string>` (required) - `rule[id=...]`, `property.path`, or `array[0]`
- `--set <key=value>` (repeatable) - Set operations with dot-notation
- `--remove <key>` (repeatable) - Remove operations
- `--config <path>` - Custom config path

**Behavior:**

1. Validate selector syntax (use parseSelector from core)
2. Parse --set flags into Record<string, unknown>
3. Parse --remove flags into string[]
4. Load config, add overlay to overlays.overrides array
5. Write config atomically
6. Success message with next steps

**Examples:**

```bash
# Change severity
aln override add --selector 'rule[id=no-console]' --set severity=error

# Nested property
aln override add --selector 'rule[id=max-complexity]' --set check.inputs.threshold=15

# Multiple operations
aln override add --selector 'rule[id=rule-one]' --set severity=warn --remove autofix
```

**Tests:** 15 tests

- Selector validation
- Set operations parsing
- Remove operations parsing
- Config updates (atomic writes)
- Error messages
- Multiple operations

### 8.3 CLI Command: override status (~12k tokens)

**Objective:** Dashboard of overlay health

**File:** `packages/cli/src/commands/override-status.ts`

**Flags:**

- `--json` - JSON output for CI
- `--config <path>` - Custom config path

**Behavior:**

1. Load config and overlays
2. Load IR from sources
3. For each overlay:
   - Evaluate selector against IR
   - Determine health: healthy (matched), stale (no match), conflict (ambiguous)
   - Count operations
4. Display summary and details

**Output:**

```
Overlays (3 active, 1 stale)

✓ rule[id=no-console-log]
  Set: severity=error
  Healthy: yes

✓ rule[id=max-complexity]
  Set: check.inputs.threshold=15
  Healthy: yes

❌ rule[id=nonexistent-rule]
  Set: severity=off
  Healthy: stale (no match in IR)
```

**JSON output:**

```json
{
  "total": 3,
  "healthy": 2,
  "stale": 1,
  "overlays": [
    {
      "selector": "rule[id=no-console-log]",
      "health": "healthy",
      "operations": { "set": { "severity": "error" } }
    }
  ]
}
```

**Tests:** 15 tests

- Display all overlays
- Health detection (healthy, stale)
- JSON output format
- Empty state (no overlays)
- Multiple overlays

### 8.4 CLI Command: override diff (~10k tokens)

**Objective:** Show overlay effects

**File:** `packages/cli/src/commands/override-diff.ts`

**Arguments:**

- `<selector>` - Optional selector to filter

**Flags:**

- `--config <path>` - Custom config path

**Behavior:**

1. Load config and IR
2. Apply overlays to IR
3. Show diff between original and modified IR
4. For specific selector: show targeted changes only

**Output:**

```
Overlay diff for: rule[id=no-console-log]

━━━ Original (upstream) ━━━
severity: warn

━━━ With overlay ━━━
severity: error

Changes: 1 property modified
```

**Tests:** 10 tests

- Diff generation
- Selector filtering
- Multiple overlays
- No changes case
- Output format

### 8.5 CLI Command: override remove (~8k tokens)

**Objective:** Remove overlays

**File:** `packages/cli/src/commands/override-remove.ts`

**Arguments:**

- `<selector>` - Selector to remove (optional, prompts if missing)

**Flags:**

- `--config <path>` - Custom config path
- `--force` - Skip confirmation

**Behavior:**

1. Load config
2. If no selector: interactive selection list
3. Find matching overlay(s)
4. Confirm removal (unless --force)
5. Remove from config
6. Write config atomically

**Output:**

```
Remove overlay: rule[id=no-console-log]?
  Set: severity=error
  (y/N): y

✓ Overlay removed
```

**Tests:** 10 tests

- Interactive selection
- Direct removal
- Confirmation prompt
- Force flag
- Multiple matches

### 8.6 Integration & Wiring (~5k tokens)

**Files Modified:**

- `packages/cli/src/index.ts` - Register override subcommands
- `packages/cli/src/commands/index.ts` - Export override commands

**Command structure:**

```
aln override add --selector <sel> --set key=value
aln override status [--json]
aln override diff [<selector>]
aln override remove [<selector>] [--force]
```

**Help text:** All commands have --help flag with examples

**Tests:** Integration tests for command registration and help

---

## Session 9: Integration Tests

**Estimated:** ~15k tokens  
**Tests:** +20 tests → 1912 total  
**Target:** End-to-end workflow validation

### 9.1 Full Overlay Workflow (~8k tokens)

**File:** `packages/cli/tests/overlay-workflow.test.ts`

**Tests:** 10 tests

1. **Add → Sync → Status → Remove workflow**
   - Add overlay via CLI
   - Run sync, verify export contains overlay
   - Check status shows healthy
   - Remove overlay
   - Verify config updated

2. **Multiple overlays workflow**
   - Add 3 overlays to different rules
   - Verify all apply correctly
   - Status shows all healthy
   - Remove one, others unaffected

3. **Stale selector detection**
   - Add overlay for rule
   - Remove rule from IR
   - Status shows stale
   - Diff shows no match

4. **Set/remove operations**
   - Add overlay with set
   - Add overlay with remove
   - Add overlay with both
   - Verify all operations applied

5. **Dot-notation paths**
   - Set nested property: `check.inputs.threshold=15`
   - Verify deep property updated
   - Status shows healthy

### 9.2 Team Mode Integration (~7k tokens)

**File:** `packages/cli/tests/overlay-team-mode.test.ts`

**Tests:** 10 tests

1. **Lockfile triple-hash**
   - Enable team mode
   - Add overlay
   - Sync generates lockfile
   - Verify base_hash, overlay_hash, result_hash present

2. **Drift detection with overlays**
   - Add overlay
   - Modify upstream
   - Run drift detection
   - Categorizes as overlay drift

3. **Update with overlays**
   - Add overlay
   - Upstream updates
   - Run update
   - Overlay re-applied to new upstream

4. **Overlay in allow list** (future)
   - Placeholder test for Phase 4

---

## Session 10: Golden Repo Finalization

**Estimated:** ~10k tokens  
**Tests:** No new unit tests (validation)  
**Target:** Real CLI commands, validated scenarios

### 10.1 Update Test Script (~5k tokens)

**File:** `examples/golden-repo/test-overlays.sh`

**Changes:**

- Replace manual config edits with `aln override add`
- Use `aln override status` for health checks
- Use `aln override diff` for three-way diffs
- Use `aln override remove` for cleanup
- Remove workarounds and mocks

**Scenarios:**

1. **Clean merge** - Overlay survives upstream update
2. **Conflict detection** - Upstream changes overlayed field
3. **Triple-hash lockfile** - Verify all three hashes
4. **Exporter integration** - Overlays reflected in exports

### 10.2 Update README (~3k tokens)

**File:** `examples/golden-repo/README.md`

**Additions:**

- Overlay workflow section
- Link to overlay scenarios
- Real CLI command examples
- Expected output examples

### 10.3 Update Scenarios (~2k tokens)

**File:** `examples/golden-repo/OVERLAY-SCENARIOS.md`

**Updates:**

- Replace mock commands with real CLI
- Update expected output to match actual CLI
- Add validation steps with real commands

---

## Final Checkpoint - Phase 3.5 Complete

**Core Deliverables:**

- [x] Overlay foundation (108 tests) ✅
- [x] Triple-hash lockfile (55 tests) ✅
- [x] Documentation (~2,000 lines) ✅
- [ ] Documentation corrections (Session 8)
- [ ] CLI commands (4 commands, 50 tests)
- [ ] Integration tests (20 tests)
- [ ] Golden repo finalization

**Test Count:** 1842 → ~1912 tests

**Integration with existing features:**

- Overlays apply before export (plugs resolve at export)
- Team mode: overlays tracked in lockfile
- Drift detection: categorizes overlay drift
- Sync: applies overlays to IR before export

**Performance validation:**

- Overlay application <100ms for typical config (5-10 overlays)
- Selector evaluation <50ms per overlay
- Lockfile generation <200ms with triple-hash

**Success criteria:**

- [ ] All 1912 tests passing
- [ ] CLI commands operational
- [ ] Documentation corrected and accurate
- [ ] Golden repo scenarios validated with real commands
- [ ] Ready for Phase 4 catalog integration

---

## Prompt for Session 8

```
Continue Phase 3.5, Session 8: Documentation Corrections & CLI Commands

Context: Sessions 1-7 complete (1842 tests passing). Overlay foundation operational with 108 tests, triple-hash lockfile implemented, comprehensive documentation created. Critical issue: Session 7 documentation describes aspirational format that doesn't match Sessions 1-2 implementation.

Reference: @phase-3-5-implementation.plan.md (lines 181-302) for Session 8 scope.

Implement:

1. Documentation Corrections (~5k tokens)
   - Update docs/overlays.md: Replace selector object format with "rule[id=...]" string format
   - Update docs/commands.md: Fix CLI command examples to match actual schema
   - Update docs/troubleshooting-overlays.md: Correct all code snippets and examples
   - Pattern: Replace `selector: { check_id }` with `selector: "rule[id=...]"`
   - Pattern: Replace `override: { severity }` with `set: { severity }`
   - Validation: Grep for old patterns, ensure complete

2. CLI Command: override add (~15k tokens, packages/cli/src/commands/override-add.ts)
   - Flags: --selector (required), --set (repeatable), --remove (repeatable), --config
   - Parse selector, validate with parseSelector() from core
   - Build overlay: { selector, set?, remove? }
   - Add to config.overlays.overrides array
   - Atomic write, success message
   - 15 tests: validation, parsing, config updates, errors

3. CLI Command: override status (~12k tokens, packages/cli/src/commands/override-status.ts)
   - Flags: --json, --config
   - Load overlays, evaluate selectors, determine health (healthy/stale)
   - Display summary with health indicators (✓/❌)
   - JSON output for CI
   - 15 tests: display, health detection, JSON format, empty state

4. CLI Command: override diff (~10k tokens, packages/cli/src/commands/override-diff.ts)
   - Arguments: <selector> (optional filter)
   - Show diff: original IR vs modified IR with overlays
   - Format: before/after with changes highlighted
   - 10 tests: diff generation, filtering, output format

5. CLI Command: override remove (~8k tokens, packages/cli/src/commands/override-remove.ts)
   - Arguments: <selector> (optional, prompts if missing)
   - Flags: --force, --config
   - Interactive selection if no selector
   - Confirm removal, update config
   - 10 tests: interactive, direct, confirmation, force

6. Integration & Wiring (~5k tokens)
   - Register subcommands in packages/cli/src/index.ts
   - Export commands from packages/cli/src/commands/index.ts
   - Help text for all commands
   - Integration tests

Target: ~55k tokens | +50 tests | Test count: 1842 → ~1892

Start with documentation corrections to establish correct examples, then implement CLI commands in order (add, status, diff, remove), ensuring each has complete tests before proceeding.

Implementation note: Use actual schema from Sessions 1-2:
- Selector: string (JSONPath: "rule[id=...]", "property.path", "array[0]")
- Operations: set (Record with dot-notation keys), remove (string array)
- Config path: overlays.overrides[] array
```
