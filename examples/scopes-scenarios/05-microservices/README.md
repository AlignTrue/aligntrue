# Microservices Architecture Scenario

**Keywords:** microservices, multiple services, service-specific rules, shared base rules, service boundaries

## Problem

Your monorepo contains multiple microservices:

- `services/auth` - Authentication service
- `services/payments` - Payment processing
- `services/notifications` - Email/SMS notifications
- `services/analytics` - Data analytics

Each service needs service-specific rules while sharing base standards.

## Solution

Use scopes for each service with shared base rules:

```yaml
scopes:
  - path: "services/auth"
    rulesets: ["base-standards", "auth-rules", "security-rules"]

  - path: "services/payments"
    rulesets:
      ["base-standards", "payment-rules", "security-rules", "pci-compliance"]

  - path: "services/notifications"
    rulesets: ["base-standards", "notification-rules"]

  - path: "services/analytics"
    rulesets: ["base-standards", "analytics-rules", "data-privacy"]
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Each service gets appropriate domain-specific rules
- Security-critical services (auth, payments) get extra scrutiny
- Compliance rules applied where needed (PCI, data privacy)
- All services share base standards

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Team boundaries
- Multi-stack monorepo
