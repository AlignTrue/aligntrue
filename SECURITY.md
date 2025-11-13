<!--
  ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY

  This file is generated from documentation source.
  To make changes, edit the source file and run: pnpm generate:repo-files

  Source: apps/docs/content/07-policies/security.md
-->

# Security, Privacy, and On-Prem Practices

AlignTrue is designed with security and privacy as core principles: local-first by default, no required cloud, deterministic outputs, and minimal data retention.

## Reporting security issues

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please use GitHub's private vulnerability reporting feature:

1. Go to https://github.com/AlignTrue/aligntrue/security/advisories
2. Click "Report a vulnerability"
3. Fill out the form with details about the vulnerability

We will respond within 48 hours and work with you to understand and address the issue.

### What to Include

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting)
- Full paths of source file(s) related to the issue
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

We release patches for security vulnerabilities as soon as possible. Only the latest minor version receives security updates.

## Data handling

- **Core operations work fully offline** - No network calls required for validate, bundle, export, or verify operations
- **No PII logging** - CLI, MCP server, and exporters do not log raw personally identifiable information
- **Redaction utility** - Mask common secret patterns and environment keys in logs and exports
- **Telemetry opt-in** - Telemetry is off by default and requires explicit opt-in

## File and Environment Security

- **No secret printing** - Secrets and access tokens are never printed to console or logs
- **Sensitive key redaction** - Known sensitive keys are redacted if environment details are logged
- **Appropriate file permissions** - Configs and outputs use appropriate file permissions
- **Air-gapped support** - Air-gapped environments work without configuration changes
- **Explicit telemetry flag** - All analytics or telemetry behind `ALIGNTRUE_TELEMETRY=on` (supports `1` as alias)
- **Atomic writes** - All artifacts written to temp file in same directory, then renamed
- **Path validation** - Paths normalized and validated to prevent directory traversal

## Network policy

- **Core path is offline** - Core commands (`validate`, `check`, `bundle`, `export`, `pack`, `verify-pack`) make no outbound requests
- **Localhost-only MCP** - MCP server binds to `127.0.0.1` only
- **Explicit remote fetches** - Remote git fetches require explicit config or flags and use local cache
- **Fail-fast on network** - If a network call would occur in core mode, fail fast with clear error

## Secrets hygiene

- **Secret pattern masking** - Redaction helper masks values for keys including: `token`, `secret`, `password`, `key`, `auth`, `cookie`, and similar
- **Path privacy** - Full home directory paths avoided in errors when possible
- **No secrets in exports** - Cursor `.mdc` and other exports contain only rules, metadata, and hashes

## Artifacts and Logs

- **Content hashes** - Stamped in lockfiles and exporter footers where specified
- **Concise, non-sensitive logs** - Logs are concise and non-sensitive by default
- **Structured logging** - `--json` flag available for structured logs
- **Deterministic artifacts** - No timestamps or UUIDs in deterministic artifacts

## On-Prem and Offline

- **No cloud dependency** - Validate, bundle, export, and verify work without cloud
- **Offline workflows** - All documented workflows function without internet access
- **Local pack mirroring** - Documented way to mirror or vendor rule packs locally

## Dependency and Supply Chain

- **Pinned dependencies** - Dependencies pinned via lockfile in releases, no floating ranges
- **Audit in CI** - `pnpm audit` runs in CI, fails on high severity unless explicitly documented exception
- **SBOM generation** - CycloneDX SBOM generated for tagged releases
- **Release checksums** - Checksums attached to release artifacts
- **Data-only packs** - Never execute code from Aligns or packs, treat as data only

## MCP and IDE Integration

- **Read-only operations** - MCP capabilities restricted to read-only operations within active workspace
- **No arbitrary execution** - No arbitrary command execution exposed through MCP
- **Minimal data exposure** - Return minimal necessary data for scope and rule queries

## YAML and Parsing Safety

- **Safe YAML parsing** - Reject anchors and custom executable types
- **Reject unsafe values** - Reject `NaN` and `Infinity` in canonicalization and hash-relevant paths
- **Size limits** - Enforce size limits on inputs to avoid memory pressure and abuse

## Build and Release Hardening

- **Reproducible builds** - Aim for reproducible CLI builds
- **Signed artifacts** - Sign release artifacts and publish checksums
- **Security changelog** - Record all security-related changes under **Security** section in `CHANGELOG.md`

## Verification checklist

- [ ] Core commands run with network disabled
- [ ] Telemetry disabled by default, only enabled with `ALIGNTRUE_TELEMETRY=on` (or `1`)
- [ ] Secrets masked in logs and error messages
- [ ] MCP server listens on localhost only
- [ ] Lockfiles and exports deterministic and timestamp-free
- [ ] SBOM generated and attached for releases
- [ ] Checksums published for release artifacts

## Incident response

Security issues are reported via GitHub's private vulnerability reporting feature (see above).

Security advisories must include:

- Short-term mitigation steps
- Pointer to patch release as soon as available
- Affected versions and fixed versions
- Severity assessment

## Related documentation

- [Development Setup](https://aligntrue.ai/docs/08-development/setup)
- [Architecture](https://aligntrue.ai/docs/08-development/architecture)
- [CI Failure Prevention](https://aligntrue.ai/docs/08-development/ci-failures)

---

_This file is auto-generated from the AlignTrue documentation site. To make changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`._
