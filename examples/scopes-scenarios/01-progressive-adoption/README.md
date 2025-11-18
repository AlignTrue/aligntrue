# Progressive Adoption Scenario

**Keywords:** different rules for new vs legacy code, strict rules in new code, lenient in legacy, gradual migration, progressive adoption, refactoring

## Problem

You're migrating a large codebase to stricter standards but can't fix everything at once. You need:

- Strict rules enforced in new code
- Lenient rules in legacy code during migration
- Clear separation between the two

## Solution

Use scopes to apply different rulesets based on directory:

```yaml
scopes:
  - path: "src/new"
    include: ["**/*.ts"]
    rulesets: ["typescript-strict"]

  - path: "src/legacy"
    include: ["**/*.ts"]
    rulesets: ["typescript-lenient"]
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- `src/new/` enforces strict TypeScript rules (no `any`, strict null checks, etc.)
- `src/legacy/` uses lenient rules (warnings instead of errors)
- New code can't regress to legacy standards
- Legacy code can be gradually migrated

## Testing

Run the test script to validate:

```bash
./test-scenario.sh
```

## Related Scenarios

- Team boundaries (different teams own different directories)
- Multi-stack monorepo (different tech stacks)
