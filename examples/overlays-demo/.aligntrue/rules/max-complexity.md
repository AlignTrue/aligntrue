---
id: "max-complexity"
version: "1.0.0"
summary: "Limit cyclomatic complexity"
severity: error
check:
  inputs:
    threshold: 10
    excludeComments: false
---

# Limit cyclomatic complexity

Keep functions simple with cyclomatic complexity under threshold.
Complex functions are hard to test and maintain.

## Guidelines

- Aim for complexity under 10 per function
- Break complex logic into smaller helper functions
- Use early returns to reduce nesting
- Extract conditional logic into well-named functions

## Refactoring strategies

1. **Extract Method**: Move complex blocks into separate functions
2. **Replace Conditional with Polymorphism**: Use strategy pattern for complex conditionals
3. **Decompose Conditional**: Break complex conditions into named variables
4. **Replace Nested Conditional with Guard Clauses**: Use early returns

## Examples

**Before (high complexity):**

```typescript
function processOrder(order) {
  if (order.items.length > 0) {
    if (order.customer.isPremium) {
      if (order.total > 100) {
        // apply discount
      } else {
        // no discount
      }
    } else {
      // regular customer
    }
  }
}
```

**After (lower complexity):**

```typescript
function processOrder(order) {
  if (order.items.length === 0) return;

  const discount = calculateDiscount(order);
  applyDiscount(order, discount);
}

function calculateDiscount(order) {
  if (!order.customer.isPremium) return 0;
  if (order.total <= 100) return 0;
  return order.total * 0.1;
}
```
