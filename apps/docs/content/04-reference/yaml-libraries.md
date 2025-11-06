---
title: YAML library design
description: Design decisions for YAML parsing in AlignTrue.
---

# YAML library design

AlignTrue uses specific YAML parsing strategies for determinism and compatibility.

## Library choice

AlignTrue uses `js-yaml` for YAML parsing with strict schema validation.

## Design principles

1. **Deterministic parsing** - Same YAML produces same IR
2. **Strict validation** - Reject invalid YAML early
3. **JSON compatibility** - YAML subset that maps cleanly to JSON
4. **No custom types** - Avoid YAML tags and anchors

## Canonicalization

YAML is canonicalized only at boundaries:

- Lockfile generation (team mode)

Not during normal operations like sync or export.

## Error handling

Invalid YAML produces actionable error messages:

```
Error: Invalid YAML in .aligntrue.yaml at line 12
  Expected mapping, got string
  Fix: Add proper indentation
```

See `packages/schema/src/validator.ts` for implementation.
