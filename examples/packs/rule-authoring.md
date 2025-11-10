---
id: "packs/base/base-rule-authoring"
version: "1.0.0"
summary: "Rule authoring guideline: clear scope, actionable directives, explicit precedence"
tags: ["meta", "rule-authoring", "governance", "paved-road"]
---

# Rule Authoring Guideline

Guidelines for writing clear, actionable, and maintainable rules with explicit scope and precedence.

## Core Principles

- **Write for the Agent** - Imperative, actionable, deterministic
- **One topic per rule** - Focused scope
- **Declare scope and exclusions explicitly** - Where does this apply?
- **Lead with hard constraints** - Most important requirements first
- **Encode precedence** - If conflicts possible, state it

## Rule Structure

### Header

- `id` - Unique identifier (e.g., `packs/base/base-testing`)
- `version` - Semantic version
- `summary` - One-line description
- `tags` - Searchable tags
- `spec_version` - AlignTrue spec version

### Metadata

- `scope` - Where rule applies:
  - `applies_to` - Glob patterns
  - `includes` - Additional files
  - `excludes` - Excluded patterns

### Body

- `rules` - Machine-checkable rules with severity
- `notes` - Clarifications for maintainers
- `guidance` - Extended documentation

## Precedence Encoding

Use explicit verbs in notes field:

- **"overrides @target"** - Takes precedence over target
- **"defers to @target"** - Target takes precedence
- **"complements @target"** - Work together without conflict

Example:

```
Precedence: overrides @base-global, complements @base-testing, defers to @base-security
```

## Best Practices

- Keep rules ≤500 lines - Split large rules
- Add minimal examples - Show expected output
- Prefer paved-road patterns - Over prohibitions
- Reference other rules with @ notation
- Keep diffs minimal - Only change what's necessary
- Remove obsolete parts - Don't accumulate cruft

## Writing Guidelines

**For agents:**

- Use imperative language: "Add", "Remove", "Ensure"
- Be specific: "Add @ts-ignore comment" not "Fix type issue"
- Include examples: "Example: `export { config as default }`"

**For humans:**

- Explain the why
- Link to standards or RFCs
- Document exceptions and their reasons
- Keep notes short and clear

## Rule Topics

Recommended rule topics (avoid mixing):

- Code quality (linting, style)
- Testing and determinism
- Documentation and README
- Security and secrets
- Performance and profiling
- Accessibility
- Compatibility and versions
- File organization
- Dependencies

## Conflict Resolution

If your rule might conflict:

1. Declare precedence in notes
2. Add conditional sections for conflicts
3. Reference related rules by @ notation
4. Include examples of precedence in guidance
