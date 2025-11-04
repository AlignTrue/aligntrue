# Markdown authoring examples

This directory demonstrates literate markdown authoring for AlignTrue rules using fenced code blocks.

## What's inside

- **`simple-rules.md`** - Basic example with inline documentation
- **`invalid-multi-block.md`** - Example showing validation errors

## Literate markdown format

AlignTrue supports authoring rules in markdown with fenced ` ```aligntrue` blocks:

````markdown
# My project rules

```aligntrue
id: my-project.standards
version: "1.0.0"
spec_version: "1"
rules:
  - id: example-rule
    summary: Example rule
    severity: error
    guidance: Rule guidance here
```
````

## Quick start

### 1. View simple example

```bash
cat simple-rules.md
```

Shows a basic rule with inline documentation.

### 2. View invalid example

```bash
cat invalid-multi-block.md
```

Shows validation errors for multiple `aligntrue` blocks (not allowed).

## Markdown → YAML workflow

### Authoring in markdown

1. **Create markdown file:**

   ```bash
   vi .aligntrue/rules.md
   ```

2. **Add fenced code block:**

   ````markdown
   ```aligntrue
   id: my-rules
   version: "1.0.0"
   spec_version: "1"
   rules:
     - id: rule-1
       summary: Rule summary
       severity: error
   ```
   ````

3. **Sync to agents:**
   ```bash
   aligntrue sync
   ```

### Round-trip (markdown ↔ YAML)

AlignTrue can convert between markdown and YAML:

```bash
# Markdown → YAML
aligntrue convert rules.md --to yaml > rules.yaml

# YAML → Markdown
aligntrue convert rules.yaml --to markdown > rules.md
```

## Benefits of markdown authoring

### 1. Inline documentation

Mix rules with explanations:

````markdown
# Code quality standards

Our team follows these standards for code quality.

```aligntrue
id: code-quality
version: "1.0.0"
spec_version: "1"
rules:
  - id: require-tests
    summary: All features must have tests
    severity: error
```

## Testing philosophy

We believe in comprehensive testing...
````

### 2. Better readability

Markdown is more readable than YAML for documentation-heavy rules.

### 3. Version control friendly

Markdown diffs are easier to review than YAML diffs.

### 4. Familiar format

Developers already know markdown.

## Validation

### Valid markdown

- Single `aligntrue` code block per file
- Valid YAML inside block
- Proper indentation

### Invalid markdown

**Multiple blocks (not allowed):**

````markdown
```aligntrue
id: rules-1
```

```aligntrue
id: rules-2  # ✗ Second block not allowed
```
````

**Invalid YAML:**

````markdown
```aligntrue
id: rules
  invalid: indentation  # ✗ Invalid YAML
```
````

## Examples

### Example 1: Simple rules

**File:** `simple-rules.md`

Shows basic rule structure with inline documentation.

### Example 2: Invalid multi-block

**File:** `invalid-multi-block.md`

Shows validation error for multiple `aligntrue` blocks.

## See also

- [Golden repo example](../golden-repo/) - Complete working example
- [Overlays demo](../overlays-demo/) - Fork-safe customization
- [Multi-agent example](../multi-agent/) - Multiple agents workflow
