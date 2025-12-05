<!--
  ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY

  This file is generated from documentation source.
  To make changes, edit the source file and run: pnpm generate:repo-files

  Source: apps/docs/content/security.md
-->

# Security, privacy, and on-prem practices

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

## Defaults at a glance

- **Offline-first CLI** - `init`, `check`, `sync`, `status`, `doctor`, `exporters`, `scopes`, and `rules` operate on local files and do not make outbound requests unless you configure remote sources.
- **No telemetry collected** - Telemetry is not emitted; tests run with `ALIGNTRUE_NO_TELEMETRY=1` to enforce this. Any future telemetry would require explicit opt-in via `ALIGNTRUE_TELEMETRY=on`.
- **Deterministic artifacts** - Lockfiles and exports include content hashes and avoid timestamps so outputs are diffable.
- **Minimal logging** - CLI output is concise and avoids printing secrets or raw PII.

## Network and data handling

- **No secret printing** - CLI output and exports avoid secrets; exports contain only rules, metadata, and hashes.
- **Offline by default** - Remote fetches (for aligns or git sources) occur only when you configure them and reuse local cache when present.
- **Local MCP access** - MCP exporters are scoped to the local workspace and avoid exposing arbitrary command execution.

## Dependency and supply chain

- **Pinned dependencies** - Releases are locked via `pnpm-lock.yaml`; no floating ranges.
- **Dependabot monitoring** - Dependabot tracks manifest updates.
- **Manual audits** - Run `pnpm audit --prod` locally before releases (not currently automated in CI).
- **Data-only aligns** - Aligns are treated as data; they are never executed.
- **SBOM and checksums** - SBOMs and release checksums are not published yet; verify releases via tags and repository hashes.

## MCP and IDE integration

- **Read-only operations** - MCP capabilities are scoped to read-only access within the active workspace.
- **No arbitrary execution** - No arbitrary command execution is exposed through MCP.
- **Minimal data exposure** - Exporters return only data needed for scope and rule queries.

## YAML and parsing safety

- **Safe YAML parsing** - Reject anchors and custom executable types.
- **Reject unsafe values** - Reject `NaN` and `Infinity` in canonicalization and hash-relevant paths.
- **Size limits** - Enforce size limits on inputs to avoid memory pressure and abuse.

## Build and release hardening

- **Reproducible outputs** - CLI artifacts aim for reproducible, deterministic content.
- **Security changelog** - Record security-related changes under **Security** in `CHANGELOG.md`.

## Verification checklist

- [ ] Core commands (`init`, `check`, `sync`, `status`, `doctor`, `exporters`, `scopes`, `rules`) run with network blocked in your environment
- [ ] Telemetry remains off (`ALIGNTRUE_TELEMETRY` unset) and tests run with `ALIGNTRUE_NO_TELEMETRY=1`
- [ ] Secrets do not appear in logs or exports
- [ ] MCP exporters remain scoped to local workspace access
- [ ] Lockfiles and exports remain deterministic (hashes stable across runs)
- [ ] `pnpm audit --prod` passes before publishing releases
- [ ] Release artifacts are verified via git tags and repository hashes (SBOM and checksums not yet published)

## Incident response

Security issues are reported via GitHub's private vulnerability reporting feature (see above).

Security advisories must include:

- Short-term mitigation steps
- Pointer to patch release as soon as available
- Affected versions and fixed versions
- Severity assessment

## Related documentation

- [Development Setup](https://aligntrue.ai/docs/06-development/setup)
- [Architecture](https://aligntrue.ai/docs/06-development/architecture)
- [CI guide](https://aligntrue.ai/docs/06-development/ci)

---

_This file is auto-generated from the AlignTrue documentation site. To make changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`._
