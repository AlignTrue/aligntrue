# Frontend-Backend Split Scenario

**Keywords:** frontend and backend, web app and API, client and server, separate concerns

## Problem

Your repository has clear frontend/backend separation:

- `frontend/` - React web application
- `backend/` - REST API server

Each side needs different rules and tooling.

## Solution

Use scopes to separate concerns:

```yaml
scopes:
  - path: "frontend"
    include: ["**/*.ts", "**/*.tsx", "**/*.jsx"]
    rulesets: ["base-rules", "react-rules", "ui-rules"]

  - path: "backend"
    include: ["**/*.ts"]
    rulesets: ["base-rules", "api-rules", "security-rules"]
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Frontend gets React, accessibility, and UI rules
- Backend gets API design, security, and database rules
- No cross-contamination of concerns
- Clear separation of responsibilities

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Multi-stack monorepo
- Team boundaries
