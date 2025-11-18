# AlignTrue Customization Scenarios

Comprehensive index of real-world scenarios for scopes, plugs, and overlays.

## Quick Search by Keyword

**Monorepo & Organization:**

- [Progressive adoption](#progressive-adoption) - Different rules for new vs legacy code
- [Team boundaries](#team-boundaries) - Different teams own different directories
- [Multi-stack monorepo](#multi-stack-monorepo) - Multiple languages/tech stacks
- [Frontend-backend split](#frontend-backend-split) - Separate concerns
- [Microservices](#microservices-architecture) - Service-specific rules

**Customization:**

- [Test command](#test-command-customization) - Different test runners per project
- [Organization metadata](#organization-metadata) - Company-specific values
- [Stack-specific paths](#stack-specific-paths) - Config file locations per stack

**Rule Modification:**

- [Severity upgrade](#severity-upgrade) - Make warnings errors
- [Temporary migration](#temporary-migration) - Disable strict rules during refactor
- [Threshold adjustment](#threshold-adjustment) - Project-specific complexity limits
- [Autofix removal](#autofix-removal) - Keep check but disable risky autofix
- [Gradual rollout](#gradual-rollout) - Progressive rule adoption

---

## Decision Tree

### I need to...

**Apply different rules to different directories**
→ Use [Scopes](#scopes-scenarios)

- Monorepo with multiple teams? → [Team boundaries](#team-boundaries)
- Multiple tech stacks? → [Multi-stack monorepo](#multi-stack-monorepo)
- Migrating gradually? → [Progressive adoption](#progressive-adoption)
- Frontend + backend? → [Frontend-backend split](#frontend-backend-split)
- Multiple services? → [Microservices architecture](#microservices-architecture)

**Customize pack values without forking**
→ Use [Plugs](#plugs-scenarios)

- Test command varies? → [Test command customization](#test-command-customization)
- Company-specific values? → [Organization metadata](#organization-metadata)
- File paths differ? → [Stack-specific paths](#stack-specific-paths)

**Modify upstream pack rules**
→ Use [Overlays](#overlays-scenarios)

- Make warnings stricter? → [Severity upgrade](#severity-upgrade)
- Temporarily relax rules? → [Temporary migration](#temporary-migration)
- Adjust thresholds? → [Threshold adjustment](#threshold-adjustment)
- Remove autofix? → [Autofix removal](#autofix-removal)
- Roll out gradually? → [Gradual rollout](#gradual-rollout)

---

## Scopes Scenarios

### Progressive Adoption

**Location:** `scopes-scenarios/01-progressive-adoption/`

**Problem:** Migrating to stricter standards but can't fix everything at once.

**Solution:** Apply strict rules to new code, lenient rules to legacy code.

**Keywords:** different rules for new vs legacy code, strict rules in new code, lenient in legacy, gradual migration, progressive adoption, refactoring

**Configuration:**

```yaml
scopes:
  - path: "src/new"
    rulesets: ["typescript-strict"]
  - path: "src/legacy"
    rulesets: ["typescript-lenient"]
```

[View full scenario →](scopes-scenarios/01-progressive-adoption/README.md)

---

### Team Boundaries

**Location:** `scopes-scenarios/02-team-boundaries/`

**Problem:** Multiple teams in same monorepo with different standards.

**Solution:** Team-specific rulesets while sharing base standards.

**Keywords:** team ownership, different teams, team-specific rules, organizational boundaries, ownership

**Configuration:**

```yaml
scopes:
  - path: "apps/web"
    rulesets: ["base-standards", "frontend-standards"]
  - path: "packages/api"
    rulesets: ["base-standards", "backend-standards"]
```

[View full scenario →](scopes-scenarios/02-team-boundaries/README.md)

---

### Multi-Stack Monorepo

**Location:** `scopes-scenarios/03-multi-stack-monorepo/`

**Problem:** Monorepo uses multiple tech stacks (Next.js, Node.js, Python).

**Solution:** Stack-specific rulesets for each language/framework.

**Keywords:** multiple languages, polyglot, Next.js and Node.js and Python, different tech stacks, mixed languages

**Configuration:**

```yaml
scopes:
  - path: "apps/web"
    include: ["**/*.ts", "**/*.tsx"]
    rulesets: ["base-rules", "nextjs-rules"]
  - path: "services/worker"
    include: ["**/*.py"]
    rulesets: ["base-rules", "python-rules"]
```

[View full scenario →](scopes-scenarios/03-multi-stack-monorepo/README.md)

---

### Frontend-Backend Split

**Location:** `scopes-scenarios/04-frontend-backend-split/`

**Problem:** Clear frontend/backend separation needs different rules.

**Solution:** Separate concerns with appropriate rules for each side.

**Keywords:** frontend and backend, web app and API, client and server, separate concerns

**Configuration:**

```yaml
scopes:
  - path: "frontend"
    rulesets: ["base-rules", "react-rules", "ui-rules"]
  - path: "backend"
    rulesets: ["base-rules", "api-rules", "security-rules"]
```

[View full scenario →](scopes-scenarios/04-frontend-backend-split/README.md)

---

### Microservices Architecture

**Location:** `scopes-scenarios/05-microservices/`

**Problem:** Multiple microservices need service-specific rules.

**Solution:** Service-specific rules with shared base standards.

**Keywords:** microservices, multiple services, service-specific rules, shared base rules, service boundaries

**Configuration:**

```yaml
scopes:
  - path: "services/auth"
    rulesets: ["base-standards", "auth-rules", "security-rules"]
  - path: "services/payments"
    rulesets: ["base-standards", "payment-rules", "pci-compliance"]
```

[View full scenario →](scopes-scenarios/05-microservices/README.md)

---

## Plugs Scenarios

### Test Command Customization

**Location:** `plugs-scenarios/01-test-command-customization/`

**Problem:** Shared pack references test command but projects use different runners.

**Solution:** Fill test command slot with project-specific value.

**Keywords:** test command, different test runners, pytest vs jest, custom test command, project-specific testing

**Configuration:**

```yaml
plugs:
  fills:
    test.cmd: "pnpm test"
    build.cmd: "pnpm build"
```

[View full scenario →](plugs-scenarios/01-test-command-customization/README.md)

---

### Organization Metadata

**Location:** `plugs-scenarios/02-organization-metadata/`

**Problem:** Shared packs reference company-specific metadata.

**Solution:** Provide organization values via plugs.

**Keywords:** company name, organization URLs, author names, team metadata, company-specific values

**Configuration:**

```yaml
plugs:
  fills:
    org.name: "Acme Corp"
    docs.url: "https://docs.acme.com"
    support.email: "support@acme.com"
```

[View full scenario →](plugs-scenarios/02-organization-metadata/README.md)

---

### Stack-Specific Paths

**Location:** `plugs-scenarios/03-stack-specific-paths/`

**Problem:** Different stacks use different file locations.

**Solution:** Specify stack-specific paths via plugs.

**Keywords:** config file paths, stack-specific locations, different file locations, path customization

**Configuration:**

```yaml
plugs:
  fills:
    config.file: "next.config.js"
    env.file: ".env.local"
    build.output: ".next"
```

[View full scenario →](plugs-scenarios/03-stack-specific-paths/README.md)

---

## Overlays Scenarios

### Severity Upgrade

**Location:** `overlays-scenarios/01-severity-upgrade/`

**Problem:** Upstream pack has warnings but team wants errors.

**Solution:** Upgrade severity via overlays.

**Keywords:** make warnings errors, upgrade severity, stricter rules, team standards, enforce warnings

**Configuration:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

[View full scenario →](overlays-scenarios/01-severity-upgrade/README.md)

---

### Temporary Migration

**Location:** `overlays-scenarios/02-temporary-migration/`

**Problem:** Major refactoring needs temporary rule relaxation.

**Solution:** Temporarily downgrade strict rules with documented removal date.

**Keywords:** disable strict rules, temporary relaxation, during refactor, migration period, gradual adoption

**Configuration:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=strict-null-checks]"
      set:
        severity: "warn"
      # TODO: Remove after migration complete (2024-Q2)
```

[View full scenario →](overlays-scenarios/02-temporary-migration/README.md)

---

### Threshold Adjustment

**Location:** `overlays-scenarios/03-threshold-adjustment/`

**Problem:** Upstream thresholds don't fit your project.

**Solution:** Adjust complexity and other thresholds.

**Keywords:** complexity threshold, adjust limits, project-specific thresholds, tune parameters

**Configuration:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        check.inputs.threshold: 20
```

[View full scenario →](overlays-scenarios/03-threshold-adjustment/README.md)

---

### Autofix Removal

**Location:** `overlays-scenarios/04-autofix-removal/`

**Problem:** Rule autofix is too aggressive.

**Solution:** Keep check but remove autofix.

**Keywords:** disable autofix, keep check but remove autofix, risky autofix, manual fix only

**Configuration:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=prefer-const]"
      remove: ["autofix"]
```

[View full scenario →](overlays-scenarios/04-autofix-removal/README.md)

---

### Gradual Rollout

**Location:** `overlays-scenarios/05-gradual-rollout/`

**Problem:** Rolling out new strict rules gradually.

**Solution:** Control rollout phase with documented progression.

**Keywords:** progressive rule adoption, phased rollout, gradual enforcement, staged deployment

**Configuration:**

```yaml
overlays:
  overrides:
    # Phase 1: Info level (current)
    - selector: "rule[id=new-rule-1]"
      set:
        severity: "info"
    # Phase 2 & 3: Commented out, uncomment when ready
```

[View full scenario →](overlays-scenarios/05-gradual-rollout/README.md)

---

## Feature Comparison

| Feature      | Use Case                      | Requires Pack Changes  | Reversible |
| ------------ | ----------------------------- | ---------------------- | ---------- |
| **Scopes**   | Different rules per directory | No                     | Yes        |
| **Plugs**    | Customize pack values         | Yes (slot declaration) | Yes        |
| **Overlays** | Modify pack rules             | No                     | Yes        |

## Related Documentation

- [Scopes Guide](../apps/docs/content/02-customization/scopes.md)
- [Plugs Guide](../apps/docs/content/02-customization/plugs.mdx)
- [Overlays Guide](../apps/docs/content/02-customization/overlays.mdx)
- [Customization Overview](../apps/docs/content/02-customization/index.md)
