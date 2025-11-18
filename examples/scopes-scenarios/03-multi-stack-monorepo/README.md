# Multi-Stack Monorepo Scenario

**Keywords:** multiple languages, polyglot, Next.js and Node.js and Python, different tech stacks, mixed languages

## Problem

Your monorepo uses multiple tech stacks:

- `apps/web` - Next.js (TypeScript + React)
- `packages/api` - Node.js (TypeScript)
- `services/worker` - Python
- `services/ml` - Python + Jupyter

Each stack needs language-specific rules.

## Solution

Use scopes with stack-specific rulesets:

```yaml
scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-rules", "nextjs-rules"]

  - path: "packages/api"
    include: ["**/*.ts"]
    rulesets: ["base-rules", "node-rules"]

  - path: "services/worker"
    include: ["**/*.py"]
    rulesets: ["base-rules", "python-rules"]

  - path: "services/ml"
    include: ["**/*.py", "**/*.ipynb"]
    rulesets: ["base-rules", "python-rules", "jupyter-rules"]
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Next.js app gets React component rules
- Node.js API gets server-side rules
- Python services get PEP 8 rules
- ML service gets Jupyter notebook rules
- Each stack maintains best practices

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Team boundaries
- Frontend-backend split
