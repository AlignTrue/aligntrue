---
id: "packs/base/base-security"
version: "1.0.0"
summary: "Security and compliance: secrets, dependencies, supply chain, least privilege"
tags: ["security", "compliance", "secrets", "supply-chain", "paved-road"]
---

# Security and Compliance Baseline

Security standards: never commit secrets, control dependencies, enforce compliance, and build with least privilege.

## Core principles

- **Never commit secrets** - Treat repo as public
- **Control dependencies** - Lockfiles and audit required
- **Enforce license compliance** - Approved licenses only
- **Run static analysis** - SAST in CI
- **Build with least privilege** - Limited access and provenance
- **Keep data and logs safe** - No production data in tests

## Secrets management

**Requirement:** Pre-commit and CI scans required.

Never commit:

- API keys, tokens, or passwords
- Database credentials
- Private encryption keys
- SSH keys or certificates
- OAuth secrets

**If leaked:**

1. Revoke immediately
2. Rotate credentials
3. Add regression check to prevent recurrence
4. Document in security incident tracking

## Supply chain security

Require:

- **Lockfiles** for all package managers
  - `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`
  - `Cargo.lock`, `poetry.lock`, `Gemfile.lock`
- **Pinned versions** - No floating ranges in production
- **No floating ranges** - `^`, `~`, `*`, `latest` forbidden
- **Audit on every PR** - `pnpm audit`, `cargo audit`, etc.
- **Only approved registries** - Block public registry if private required

Maintenance:

- **Schedule regular updates** - Weekly or monthly
- **Test updates** before merging
- **Document security updates** in changelog

## Dependency audit

**Requirement:** High and critical vulnerabilities must be resolved.

Run audits:

```bash
pnpm audit --audit-level=high
npm audit
cargo audit
pip-audit
```

**Resolution options:**

1. Update the package
2. Add explicit waiver with tracking issue
3. Remove the dependency if unused

## License compliance

Check third-party licenses:

- **Block disallowed licenses** - GPL in proprietary code, etc.
- **Document exceptions** - With justification
- **Use license-check tools** - SPDX compliance

## Static application security testing (SAST)

In CI:

- **High findings block** - No merge
- **Scan all branches** - PRs and main
- **Surface reports** - As artifacts
- **Fix or waive** - With issue tracking

## Environment configuration

**Requirement:** `.env.example` documents required variables.

Template with placeholder values:

```
API_KEY=your-api-key-here
DATABASE_URL=postgres://user:pass@localhost/db
DEBUG=false
```

For runtime:

- Store secrets in approved manager (Vault, KMS, cloud provider)
- Never hardcode
- Rotate regularly

## Build and Container Security

- **CI with least privilege** - Limited permissions
- **Pinned base images** - No `latest` tags
- **Generate SBOM** - Software Bill of Materials per release
- **Sign artifacts** - When enabled
- **Scan containers** - For vulnerabilities

## Data safety

- **No production data** in tests
- **Redact secrets/PII** in logs
- **Follow data classification** - Internal vs public
- **Cleanup** - Remove temporary test data
- **Backup** - Secure backups with encryption

## CI Gates

- **Block merge on scan failures** - No exceptions without review
- **Surface reports** - Make findings visible
- **Keep logs secret-free** - Redact before storage
- **Audit access** - Track who reviewed waivers
