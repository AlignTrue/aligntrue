# Agent comparison

Detailed comparison of how different agents handle the same rules.

## Rule: require-tests

### Core rule (all agents)

```yaml
id: require-tests
summary: All features must have tests
severity: error
guidance: Write unit tests for all new features.
```

### Cursor

**File:** `.cursor/rules/require-tests.mdc` (one file per rule)

**Format:**

```markdown
## Rule: require-tests

**Severity:** error

**Applies to:**

- `src/**/*.ts`
- `src/**/*.tsx`

Write unit tests for all new features.
Test files should be co-located with source files.

**AI Hint:** Suggest test file path and basic test structure using Vitest
**Quick Fix:** Enabled
**Priority:** High
```

**Features:**

- Full rule support
- Vendor bag hints active
- Quick fix suggestions
- Priority levels

### Universal (AGENTS.md)

**File:** `AGENTS.md`

**Format:**

```markdown
## Rule: require-tests

**ID:** require-tests
**Severity:** ERROR
**Scope:** src/**/\*.ts, src/**/\*.tsx

Write unit tests for all new features.
Test files should be co-located with source files.

Examples:

- src/utils/parser.ts → src/utils/parser.test.ts
- src/components/Button.tsx → src/components/Button.test.tsx
```

**Features:**

- Simple markdown format
- Works with most agents
- No vendor bag hints (preserved in metadata)
- Content hash verification

**Fidelity notes:**

- Vendor-specific metadata preserved but not active

### GitHub Copilot

**File:** `.github/copilot-instructions.md`

**Format:**

```markdown
## require-tests (ERROR)

Write unit tests for all new features.
Test files should be co-located with source files.

**Suggestion level:** Detailed
**Show examples:** Yes

Examples:

- src/utils/parser.ts → src/utils/parser.test.ts
- src/components/Button.tsx → src/components/Button.test.tsx
```

**Features:**

- Copilot-optimized format
- Suggestion levels
- Example code
- Severity mapped to priority

**Fidelity notes:**

- Severity levels mapped to suggestion priority
- Quick fix not supported

### VS Code MCP

**File:** `.vscode/mcp.json`

**Format:**

```json
{
  "mcpServers": {
    "aligntrue": {
      "command": "aligntrue",
      "args": ["mcp"],
      "rules": [
        {
          "id": "require-tests",
          "severity": "error",
          "patterns": ["src/**/*.ts", "src/**/*.tsx"],
          "message": "All features must have tests"
        }
      ]
    }
  }
}
```

**Features:**

- MCP server configuration
- Tool definitions
- Resource mappings
- JSON format

**Fidelity notes:**

- Guidance text truncated to message
- Vendor bags not represented

## Vendor bag comparison

### Same rule, different hints

**Rule ID:** `no-console-log`

**Cursor:**

```yaml
vendor:
  cursor:
    ai_hint: "Suggest logger.info() or logger.error() replacement"
    quick_fix: true
    priority: medium
```

→ Shows quick fix with logger suggestions

**Claude:**

```yaml
vendor:
  claude:
    mode: "assistant"
    context: "Focus on security implications"
```

→ Emphasizes security in explanations

**Copilot:**

```yaml
vendor:
  copilot:
    suggestions: "conservative"
    show_examples: true
```

→ Shows conservative suggestions with examples

## Feature support matrix

| Feature        | Cursor        | AGENTS.md      | Copilot              | VS Code MCP    |
| -------------- | ------------- | -------------- | -------------------- | -------------- |
| Rule ID        | ✅            | ✅             | ✅                   | ✅             |
| Severity       | ✅            | ✅             | ✅ (mapped)          | ✅             |
| Applies to     | ✅ (metadata) | ✅             | ✅                   | ✅             |
| Guidance       | ✅            | ✅             | ✅                   | ⚠️ (truncated) |
| Vendor bags    | ✅ (active)   | ⚠️ (preserved) | ⚠️ (preserved)       | ❌             |
| Quick fix      | ✅            | ❌             | ❌                   | ❌             |
| AI hints       | ✅            | ❌             | ⚠️ (via suggestions) | ❌             |
| Priority       | ✅            | ❌             | ⚠️ (via severity)    | ❌             |
| Content hash   | ✅            | ✅             | ✅                   | ✅             |
| Fidelity notes | ✅            | ✅             | ✅                   | ✅             |

**Legend:**

- ✅ Fully supported
- ⚠️ Partially supported or mapped
- ❌ Not supported

## Content hash verification

All exporters include content hash for integrity verification.

### Cursor

```
Content Hash: abc123...
```

### AGENTS.md

```
Content Hash: abc123...
```

### Copilot

```
Content Hash: abc123...
```

### VS Code MCP

```json
{
  "contentHash": "abc123..."
}
```

**Purpose:**

- Verify files haven't been manually edited
- Detect drift from source
- Ensure consistency across agents

## Fidelity notes by agent

### Cursor

```
Fidelity Notes:
- applies_to patterns preserved in metadata but not enforced by Cursor
```

**Impact:** Minimal. Cursor applies rules universally but preserves patterns for round-trips.

### AGENTS.md

```
Fidelity Notes:
- Machine-checkable rules (check) not represented in AGENTS.md format
- Autofix hints not represented in AGENTS.md format
- Vendor-specific metadata preserved but not active in universal format
```

**Impact:** Moderate. Universal format focuses on guidance, not enforcement.

### GitHub Copilot

```
Fidelity Notes:
- Severity levels mapped to suggestion priority
- Machine-checkable rules (check) not supported
- Quick fix not supported
```

**Impact:** Moderate. Copilot focuses on suggestions, not enforcement.

### VS Code MCP

```
Fidelity Notes:
- Guidance text truncated to message field
- Vendor bags not represented in MCP format
- Limited to MCP server capabilities
```

**Impact:** High. MCP format is more constrained than others.

## Best practices

### 1. Use IR-source workflow

Edit `AGENTS.md` or `.aligntrue/.rules.yaml` as single source of truth:

```bash
vi AGENTS.md
aligntrue sync
```

**Why:** Prevents conflicts between agent files. `AGENTS.md` is primary (user-editable), `.aligntrue/.rules.yaml` is internal IR.

### 2. Use vendor bags sparingly

Only add vendor bags for truly agent-specific settings:

```yaml
vendor:
  cursor:
    quick_fix: true # Cursor-specific feature
```

**Why:** Too many vendor bags make rules hard to maintain.

### 3. Test with multiple agents

Verify rules work across all agents:

```bash
aligntrue sync
# Test in Cursor
# Test in VS Code with Copilot
# Test in Claude Code
```

**Why:** Catch agent-specific issues early.

### 4. Review fidelity notes

Check what features are supported per agent:

```bash
tail -20 .cursor/rules/*.mdc
tail -20 AGENTS.md
```

**Why:** Understand limitations and adjust expectations.

### 5. Keep core rules consistent

Put rule logic in `guidance`, not vendor bags:

```yaml
# Good
guidance: Use proper logging library
vendor:
  cursor:
    ai_hint: "Suggest logger.info()"

# Bad
vendor:
  cursor:
    rule_text: "Use proper logging library"
```

**Why:** Guidance is universal and works across all agents.

## Troubleshooting

### Rules not syncing to all agents

**Problem:** Some agents not getting updated rules.

**Check:**

```bash
cat .aligntrue/config.yaml | grep -A 10 exporters
```

**Fix:** Add missing exporters to config.

### Different behavior across agents

**Problem:** Agents behave differently despite same rules.

**Expected:** Agents interpret rules differently based on their capabilities.

**Check fidelity notes:**

```bash
tail -20 AGENTS.md
```

**Solution:** Accept limitations or use agent-specific exporters.

### Vendor bags not preserved

**Problem:** Agent-specific fields lost after sync.

**Check:**

```bash
grep -A 5 "vendor:" .aligntrue/.rules.yaml
```

**Fix:** Ensure vendor namespace is correct:

```yaml
# Good
vendor:
  cursor:
    ai_hint: "hint"

# Bad
cursor:
  ai_hint: "hint"
```

## Summary

**Multi-agent workflow benefits:**

- ✅ Single source of truth (`AGENTS.md` with auto-generated `.aligntrue/.rules.yaml`)
- ✅ Sync to all agents automatically
- ✅ Consistent rules across agents
- ✅ Agent-specific hints via vendor bags
- ✅ Content hash verification
- ✅ Fidelity notes for transparency

**Key takeaway:** AlignTrue makes multi-agent workflows simple by maintaining one source of truth that syncs to all agents automatically, while preserving agent-specific customizations via vendor bags.
