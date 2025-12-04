---
id: "no-console-log"
version: "1.0.0"
summary: "Avoid console.log in production code"
severity: warn
---

# Avoid console.log in production code

Use proper logging library instead of console.log.
Console statements can leak sensitive information and
clutter production logs.

## Examples

**Good:**

```javascript
logger.info("User logged in");
```

**Bad:**

```javascript
console.log("User logged in");
```

## Why this matters

- Console logs are often left in production code by accident
- They can expose sensitive data in browser dev tools
- Proper logging libraries provide log levels, filtering, and structured output
- Production logs should be machine-parseable for monitoring systems
