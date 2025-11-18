# Team Boundaries Scenario

**Keywords:** team ownership, different teams, team-specific rules, organizational boundaries, ownership

## Problem

Multiple teams work in the same monorepo with different standards:

- Frontend team owns `apps/web` and `apps/mobile`
- Backend team owns `packages/api` and `services/*`
- Platform team owns `packages/shared`

Each team needs their own rules while sharing base standards.

## Solution

Use scopes to apply team-specific rulesets:

```yaml
scopes:
  - path: "apps/web"
    rulesets: ["base-standards", "frontend-standards"]

  - path: "apps/mobile"
    rulesets: ["base-standards", "frontend-standards"]

  - path: "packages/api"
    rulesets: ["base-standards", "backend-standards"]

  - path: "packages/shared"
    rulesets: ["base-standards"]
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Frontend team gets React/Next.js specific rules
- Backend team gets Node.js/API specific rules
- Shared packages follow base standards only
- Teams maintain autonomy while sharing core values

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Multi-stack monorepo
- Microservices architecture
