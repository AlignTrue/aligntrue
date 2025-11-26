# Overlays demo rules

This file demonstrates overlays applied to upstream rules.

```aligntrue
id: overlays-demo
version: "1.0.0"
spec_version: "1"

profile:
  id: example/overlays-demo
  version: "1.0.0"

# Import upstream align rules (simulated)
rules:
  - id: no-console-log
    summary: Avoid console.log in production code
    severity: warn
    applies_to:
      patterns: ["**/*.ts", "**/*.js"]
    guidance: |
      Use proper logging library instead of console.log.
      Console statements can leak sensitive information and
      clutter production logs.

      Good: logger.info("User logged in")
      Bad: console.log("User logged in")

  - id: max-complexity
    summary: Limit cyclomatic complexity
    severity: error
    applies_to:
      patterns: ["**/*.ts", "**/*.js"]
    guidance: |
      Keep functions simple with cyclomatic complexity under threshold.
      Complex functions are hard to test and maintain.

      Refactor complex functions into smaller, focused functions.
    check:
      inputs:
        threshold: 10
        excludeComments: false

  - id: prefer-const
    summary: Use const for variables that are never reassigned
    severity: warn
    applies_to:
      patterns: ["**/*.ts", "**/*.js"]
    guidance: |
      Use const instead of let for variables that are never reassigned.
      This makes code more predictable and prevents accidental reassignment.

      Good: const user = getUser();
      Bad: let user = getUser();
    autofix:
      enabled: true
      description: "Replace let with const"

# Overlays: Customize without forking
overlays:
  overrides:
    # Scenario 1: Upgrade severity for team standards
    # Team policy: No console.log in production (stricter than upstream)
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"  # Upgraded from warn

    # Scenario 2: Adjust threshold for project needs
    # Project has complex domain logic, allow higher complexity
    - selector: "rule[id=max-complexity]"
      set:
        "check.inputs.threshold": 15  # Increased from 10
        "check.inputs.excludeComments": true

    # Scenario 3: Remove autofix that conflicts with framework
    # Autofix conflicts with React hooks dependencies
    - selector: "rule[id=prefer-const]"
      remove:
        - "autofix"
```
