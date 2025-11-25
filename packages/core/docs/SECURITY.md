# AlignTrue Core Security

**Package:** `@aligntrue/core`  
**Last Updated:** 2025-10-27 (Step 20)  
**Status:** Security posture implemented

This document describes the security guarantees, boundaries, and expectations for the AlignTrue core package.

---

## Security Guarantees

### 1. Atomic Writes Prevent Partial State

**Implementation:** `packages/core/src/sync/file-operations.ts` - `AtomicFileWriter`

**Guarantee:** All file writes use a temp file + atomic rename pattern. This ensures:

- No partial writes on crash or error
- Files are always in a consistent state (complete or unchanged)
- Backup created before overwriting existing files
- Rollback available if operations fail

**Pattern:**

```typescript
// Write to temp file
writeFileSync(`${filePath}.tmp`, content, "utf8");

// Atomic rename (OS-level guarantee)
renameSync(`${filePath}.tmp`, filePath);
```

**Tests:** `packages/core/tests/security/atomic-writes.test.ts`

---

### 2. Path Validation Prevents Directory Traversal

**Implementation:** `packages/core/src/scope.ts` - `validateScopePath()`

**Guarantee:** All user-provided paths are validated to prevent directory traversal attacks:

- Reject paths containing `..` (parent directory traversal)
- Reject absolute paths (`/tmp/malicious`, `C:\temp`)
- Normalize Windows backslashes to forward slashes
- Applied to: scope paths, local source paths, output directories

**Validation points:**

- Config loading: `packages/core/src/config/index.ts` (scopes and local sources)
- Sync engine: `packages/core/src/sync/engine.ts` (output paths)
- Future: Cache paths when implemented (Step 27)

**Examples:**

```typescript
validateScopePath("src/components"); // ✅ Valid
validateScopePath("apps/web/.aligntrue"); // ✅ Valid
validateScopePath("../../../etc/passwd"); // ❌ Throws error
validateScopePath("/tmp/malicious"); // ❌ Throws error
validateScopePath("src/../../outside"); // ❌ Throws error
```

**Tests:** `packages/core/tests/security/path-traversal.test.ts`

---

### 3. Regex Safety Prevents ReDoS

**Implementation:** `packages/core/src/security/regex-validator.ts`

**Guarantee:** All regex patterns constructed from user input are validated to prevent ReDoS (Regular Expression Denial of Service) attacks:

- Pattern length limits (max 200 characters)
- Detection of nested quantifiers that could cause catastrophic backtracking
- Proper escaping of special characters
- Safe regex construction via `safeRegExp()` helper

**Validation points:**

- User-provided glob patterns in `packages/cli/src/utils/detect-agents.ts`
- Pattern matching in exporters (`packages/exporters/src/base/exporter-base.ts`)
- Git integration markers (`packages/core/src/sync/git-integration.ts`)

**Examples:**

```typescript
// ✅ Safe: Pattern length validated, escaped properly
if (pattern.length > 200) {
  throw new Error("Pattern too long");
}
const escaped = escapeForRegex(pattern);
const regex = safeRegExp(`^${escaped}$`);

// ❌ Unsafe: No validation, could cause ReDoS
const regex = new RegExp(`^${userPattern}$`);
```

**Static regex patterns** (not from user input) are safe and don't require validation.

**Tests:** `packages/core/tests/security/regex-safety.test.ts` (planned)

---

### 4. Prototype Pollution Prevention

**Implementation:** `packages/core/src/overlays/operations.ts`, `packages/cli/src/commands/config.ts`

**Guarantee:** All dynamic object property access validates keys to prevent prototype pollution:

- Explicit checks for `__proto__`, `constructor`, `prototype` before access
- Validation of property paths before navigation
- Safe property access patterns

**Validation points:**

- Overlay operations (`packages/core/src/overlays/operations.ts:38-46`)
- Config manipulation (`packages/cli/src/commands/config.ts:569-571`)
- Selector engine property navigation (`packages/core/src/overlays/selector-engine.ts`)

**Examples:**

```typescript
// ✅ Safe: Prototype pollution prevented by explicit checks
if (
  segment === "__proto__" ||
  segment === "constructor" ||
  segment === "prototype"
) {
  throw new Error("Invalid key");
}
current[segment] = value;

// ❌ Unsafe: No protection against prototype pollution
current[userKey] = value;
```

---

### 5. Checksum Tracking Detects Tampering

**Implementation:** `packages/core/src/sync/file-operations.ts` - `AtomicFileWriter`

**Guarantee:** File checksums are tracked to detect manual edits:

- SHA-256 checksums computed after each write
- Checksum mismatch detected before overwriting
- Interactive prompts for conflict resolution
- Force flag available for non-interactive use

**Workflow:**

1. Write file → Compute SHA-256 checksum → Store in memory
2. Next write → Check current file checksum vs stored checksum
3. Mismatch → Prompt user or throw error
4. User can view diff, keep changes, or overwrite

**Tests:** `packages/core/tests/security/atomic-writes.test.ts`

---

### 6. Backup and Rollback Available

**Implementation:** `packages/core/src/sync/file-operations.ts` - `AtomicFileWriter.rollback()`

**Guarantee:** Backups created before overwrites, rollback available on error:

- `.backup` files created before overwriting existing files
- Backups cleaned up automatically on success
- `rollback()` method restores all backed-up files
- Error details provided if rollback fails

**Usage:**

```typescript
const writer = new AtomicFileWriter();

try {
  await writer.write("file1.txt", "new content");
  await writer.write("file2.txt", "new content");
  // Success - backups automatically cleaned
} catch (err) {
  // Restore original state
  writer.rollback();
  throw err;
}
```

**Tests:** `packages/core/tests/security/atomic-writes.test.ts`

---

## Security Boundaries

### All File Operations Within Workspace

**Enforcement:** Path validation in config loading and sync engine

**Boundary:** AlignTrue only operates on files within the workspace directory:

- All paths must be relative (not absolute)
- No parent directory traversal allowed
- Output paths constructed safely with validated inputs

**Rationale:** Prevents accidental or malicious writes to system files or other projects.

---

### No Parent Directory Traversal

**Enforcement:** `validateScopePath()` called at all path entry points

**Rejected patterns:**

- `../../../etc/passwd`
- `src/../../outside/file.md`
- `..` (bare parent reference)
- `/tmp/absolute` (absolute paths)
- `C:\temp` (Windows absolute paths)

**Accepted patterns:**

- `src/components`
- `apps/web/.aligntrue/rules`
- `.` (current directory)
- Paths with dots in filenames (e.g., `config.test.ts`)

---

### No Absolute Paths in User-Provided Configs

**Enforcement:** JSON Schema validation + runtime path checks

**Locations validated:**

- `sources[].path` (local source paths)
- `scopes[].path` (scope definitions)
- Output paths constructed by sync engine

**Example rejection:**

```yaml
sources:
  - type: local
    path: /tmp/.rules.yaml # ❌ Rejected: absolute path not allowed
```

---

### Temp Files Cleaned Up on Error

**Enforcement:** Try-catch blocks in `AtomicFileWriter.write()`

**Guarantee:**

- `.tmp` files removed if rename fails
- `.backup` files removed on successful write
- Rollback cleans up backup files after restoration
- No leftover temporary files in error paths

---

## Exporter Safety Expectations

**Status:** Trust-based contract (implemented)
**Runtime enforcement:** Future enhancement

### Expectations for Exporter Implementations

Exporters (community-contributed or official) should follow these safety guidelines:

#### 1. No Network Calls During Export

**Why:** Exporters should be deterministic and work offline.

**Violation example:**

```typescript
// ❌ Don't do this
async export(request, options) {
  await fetch('https://api.example.com/track')  // Bad
  // ... generate output
}
```

**Correct approach:**

```typescript
// ✅ Do this
async export(request, options) {
  // Only work with local data
  const output = generateOutput(request.rules)
  return { success: true, filesWritten: [...] }
}
```

---

#### 2. Only Write Files via Provided Mechanisms

**Why:** Ensures atomic writes and proper error handling.

**Violation example:**

```typescript
// ❌ Don't do this
import { writeFileSync } from "fs";
writeFileSync("/tmp/output.txt", content); // Bad
```

**Correct approach:**

```typescript
// ✅ Do this (exporters should use exportOptions.outputDir)
const outputPath = join(options.outputDir, ".cursor/rules.mdc");
// Framework handles atomic writes
```

---

#### 3. Don't Execute External Commands

**Why:** Security risk and determinism violation.

**Violation example:**

```typescript
// ❌ Don't do this
import { execSync } from "child_process";
execSync("npm install something"); // Bad
```

**Correct approach:**

```typescript
// ✅ Do this - pure transformation only
function transformRules(rules: AlignRule[]): string {
  return rules.map(formatRule).join("\n");
}
```

---

#### 4. Document Unsafe Operations in Fidelity Notes

If an exporter cannot support a feature safely:

```typescript
const fidelityNotes = [];

if (rule.autofix?.command) {
  fidelityNotes.push(
    "Autofix commands not executed for security - stored as metadata only",
  );
}

return {
  success: true,
  fidelityNotes,
  // ...
};
```

---

## Security Linting and Suppression Policy

**Policy:** `.cursor/rules/security-linting-policy.mdc`

**Goal:** Make `pnpm check` output show only actionable security warnings by suppressing false positives with proper documentation.

### When to Suppress

1. **Safe Internal Paths**: Paths from `getAlignTruePaths()`, schema files, lockfiles
2. **Validated User Input**: Paths validated via `validateScopePath()` at config load time
3. **Prototype Pollution Protection**: Dynamic property access with explicit `__proto__`/`constructor`/`prototype` checks
4. **Static Regex Patterns**: Regex patterns not constructed from user input

### When to Fix

1. **Unvalidated User Paths**: Must go through `validateScopePath()` or similar
2. **Unsafe Regex from User Input**: Must validate length, escape properly, use `safeRegExp()`
3. **Unprotected Object Property Access**: Must check for dangerous keys before access

### Suppression Requirements

All suppressions must include:

- Rule name being suppressed
- Rationale explaining why code is safe
- Reference to protection/validation code

**Example:**

```typescript
// eslint-disable-next-line security/detect-non-literal-fs-filename
// Safe: Path is typically from getAlignTruePaths().lockfile (safe internal path)
const content = readFileSync(path, "utf8");
```

See `.cursor/rules/security-linting-policy.mdc` for complete guidelines.

---

## Validation Happens at Engine Level

**Current approach:** Sync engine validates paths before calling exporters.

**Location:** `packages/core/src/sync/engine.ts`

```typescript
// Security: Validate output paths don't escape workspace
if (outputPath.includes("..") || posix.isAbsolute(outputPath)) {
  warnings.push(
    `Skipped ${exporter.name}: invalid output path "${outputPath}"`,
  );
  continue;
}
```

**Future:** Runtime enforcement may be added (sandbox, network blocking, etc.).

---

## Threat Model

### In Scope

**Accidental misconfiguration:**

- User accidentally configures path traversal
- Typo leads to absolute path
- Manual file edits conflict with sync

**File corruption:**

- Crashes during write operations
- Disk full errors
- Permission issues

**Protection:**

- Path validation rejects dangerous configs
- Atomic writes prevent partial state
- Checksums detect tampering
- Backups enable recovery

---

### Out of Scope

**Malicious exporters:**

- Community exporter making network calls
- Exporter executing shell commands
- Exporter writing to arbitrary paths

**Mitigation:**

- Trust-based expectations documented
- Code review for official exporters
- Community reputation/vetting

**Future:**

- Runtime sandboxing (no network, no exec, path restrictions)
- Exporter signing and verification
- Permission model for risky operations

---

**Supply chain attacks:**

- Compromised npm dependencies
- Malicious YAML in catalog packs

**Mitigation:**

- Standard npm security practices
- Catalog integrity hashes (Step 27)
- No code execution from YAML

**Future:**

- Sigstore signing for catalog packs
- Dependency scanning in CI
- Catalog governance policies

---

## Security Testing

### Test Coverage

**Path Traversal:** 15 tests  
**Atomic Writes:** 12 tests  
**Source Path Validation:** 8 tests  
**Total:** 35 security-focused tests

**Files:**

- `packages/core/tests/security/path-traversal.test.ts`
- `packages/core/tests/security/atomic-writes.test.ts`
- `packages/core/tests/config.test.ts` (source path validation section)

---

### Manual Validation Checklist

Before releasing new features:

1. **Path validation:**
   - [ ] Try malicious scope path: `path: "../../etc"`
   - [ ] Verify clear error message with "parent directory traversal"
   - [ ] Try absolute source path: `path: "/tmp/malicious"`
   - [ ] Verify error message with "absolute paths not allowed"

2. **Atomic writes:**
   - [ ] Simulate crash during write (kill process)
   - [ ] Verify no partial files (`.tmp` cleaned up)
   - [ ] Check backup created before overwrite
   - [ ] Verify rollback restores original content

3. **Checksum protection:**
   - [ ] Run sync, manually edit output file
   - [ ] Run sync again, verify prompt appears
   - [ ] Test `--force` flag overrides prompt
   - [ ] Verify non-interactive mode throws clear error

4. **Normal workflow:**
   - [ ] `aligntrue init` completes successfully
   - [ ] `aligntrue sync` writes files atomically
   - [ ] All operations stay within workspace
   - [ ] No leftover `.tmp` or `.backup` files

---

## Security Contact

**For security issues:** Open a GitHub issue with label `security` or email the maintainers directly.

**Response time:** Best effort (pre-1.0, no SLA)

**Responsible disclosure:** We appreciate coordinated disclosure. Please allow 90 days before public disclosure.

---

## Future Enhancements

**Runtime Sandboxing:**

- Use Node.js VM or worker threads to isolate exporters
- Block network access (no `fetch`, `http`, `https`)
- Block file system access outside workspace
- Block `child_process` and `exec` family

**Exporter Signing:**

- Sigstore signatures for official exporters
- Manifest includes signature and public key
- Verification before loading handlers

**Audit Logging:**

- Log all file operations with timestamps
- Log path validation failures
- Export audit log for security review

**Permission Model:**

- Exporters declare required permissions in manifest
- User approval required for risky operations
- Deny-by-default for network/exec

---

## References

**Architecture Decisions:** `.internal_docs/architecture-decisions.md` - Decision 16 (Security Posture)
**Implementation Plan:** `.internal_docs/refactor-plan.md` - Stage 3, Step 20  
**Test Patterns:** `packages/core/tests/security/`  
**Exporter Guidelines:** `packages/exporters/README.md` - Security Expectations section
