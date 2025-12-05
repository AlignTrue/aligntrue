---
title: Windows platform limitations
description: Known limitations and workarounds when running AlignTrue on Windows
---

# Windows platform limitations

AlignTrue is primarily developed and tested on Unix-like systems (macOS, Linux). While the core functionality works on Windows, there are some known limitations and differences in behavior.

## CI/CD considerations

Windows runners execute the full CI pipeline, but many integration suites opt out on Windows (`process.platform === "win32" ? describe.skip : describe`) because of flaky file locking. macOS and Linux jobs run the same suites to preserve coverage. Prefer Ubuntu or macOS runners when you need end-to-end test signals.

### File locking (EBUSY errors)

Windows has stricter file locking semantics than Unix systems. This can cause `EBUSY` errors when:

- Multiple processes access the same files concurrently
- Files are still open when cleanup or deletion is attempted
- Temporary directories are being removed while files are in use

**Workarounds**

- Close file handles promptly and avoid keeping the repo open in Explorer while tests run.
- Run tests single-threaded to reduce concurrent file access, e.g. `pnpm --filter @aligntrue/cli vitest run --runInBand`.
- Clean leftovers with `pnpm cleanup:temps` (deletes `temp-*` artifacts created by tests).

### File permissions (chmod)

The `chmod` command and file permission bits behave differently on Windows:

- Read-only flags may not be enforced consistently
- Permission inheritance works differently than Unix
- Some permission tests may produce different results

**Workarounds**

- Prefer Windows-native APIs when you truly need permission checks.
- Skip or conditionally guard permission-sensitive tests on Windows to avoid false negatives.

### Path handling

Windows uses backslash (`\`) as the path separator while Unix uses forward slash (`/`):

- AlignTrue normalizes paths internally, but some edge cases may occur
- UNC paths and drive letters require special handling
- CRLF line endings can introduce noise in generated files and diffs

**Workarounds**

- Use `path.join()` and `path.resolve()` consistently rather than string concatenation.
- Configure Git to avoid CRLF churn: `git config core.autocrlf input`, and ensure your editor writes LF line endings.

## Test coverage

The following suites are currently skipped on Windows due to file locking and temp directory reuse (see `packages/cli/tests/**` for `describe.skip` guards). They run on macOS and Linux:

| Area                     | Status on Windows | Reason                             |
| ------------------------ | ----------------- | ---------------------------------- |
| CLI integration & e2e    | Skipped           | Flaky `EBUSY` during temp cleanup  |
| Permission-sensitive I/O | Partially skipped | Windows does not mirror Unix chmod |

Unit and library tests continue to run; production usage (sync, export, validation) remains supported on Windows.

## Recommended practices

1. Prefer Ubuntu/macOS runners or WSL for full test signals; use Windows runners for smoke checks.
2. Run heavy suites in-band when you must stay on Windows to reduce lock contention.
3. After failures, run `pnpm cleanup:temps` before retrying to clear locked temp files.

## Reporting Windows-specific issues

If you encounter a Windows-specific issue not covered here:

1. Confirm it is not a known file locking issue and rerun after cleanup.
2. Include Windows version, Node version, shell, exact command, and the stack trace (especially `EBUSY` codes).
3. Note whether you ran under WSL or native Windows and whether `--runInBand` helped.

We aim to maintain Windows compatibility for all user-facing functionality while acknowledging test infrastructure limitations.
