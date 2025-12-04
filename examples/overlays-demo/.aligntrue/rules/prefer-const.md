---
id: "prefer-const"
version: "1.0.0"
summary: "Use const for variables that are never reassigned"
severity: warn
autofix:
  enabled: true
  description: "Replace let with const"
---

# Use const for variables that are never reassigned

Use const instead of let for variables that are never reassigned.
This makes code more predictable and prevents accidental reassignment.

## Examples

**Good:**

```javascript
const user = getUser();
const items = fetchItems();
const config = loadConfig();
```

**Bad:**

```javascript
let user = getUser();
let items = fetchItems();
let config = loadConfig();
```

## Why prefer const

1. **Intent is clear**: Readers know the variable won't change
2. **Prevents bugs**: Can't accidentally reassign
3. **Optimization hints**: JavaScript engines can optimize const better
4. **Easier refactoring**: Safe to move const declarations around

## When to use let

Use `let` only when you need to reassign:

```javascript
let count = 0;
for (const item of items) {
  count += item.value;
}

let result = null;
if (condition) {
  result = computeA();
} else {
  result = computeB();
}
```

## Autofix

This rule can be automatically fixed. Running the linter with `--fix` will replace `let` with `const` where applicable.
