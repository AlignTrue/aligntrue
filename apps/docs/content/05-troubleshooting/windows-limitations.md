---
title: Windows platform limitations
description: Known limitations and workarounds when running AlignTrue on Windows
---

# Windows platform limitations

AlignTrue is primarily developed and tested on Unix-like systems (macOS, Linux). While the core functionality works on Windows, there are some known limitations and differences in behavior.

## CI/CD considerations

When running AlignTrue in CI pipelines on Windows runners, be aware of the following:

### File locking (EBUSY errors)

Windows has stricter file locking semantics than Unix systems. This can cause `EBUSY` errors when:

- Multiple processes access the same files concurrently
- Files are still open when cleanup or deletion is attempted
- Temporary directories are being removed while files are in use

**Workaround:** Add small delays between file operations or use retry logic for file cleanup.

### File permissions (chmod)

The `chmod` command and file permission bits behave differently on Windows:

- Read-only flags may not be enforced consistently
- Permission inheritance works differently than Unix
- Some permission tests may produce different results

**Workaround:** Skip permission-specific tests on Windows or use Windows-native permission APIs.

### Path handling

Windows uses backslash (`\`) as the path separator while Unix uses forward slash (`/`):

- AlignTrue normalizes paths internally, but some edge cases may occur
- UNC paths and drive letters require special handling

**Workaround:** Use `path.join()` and `path.resolve()` consistently rather than string concatenation.

## Test coverage

The following test categories are skipped on Windows CI due to file locking issues:

| Test category     | Reason for skip                    |
| ----------------- | ---------------------------------- |
| Sync workflow     | EBUSY during temp file cleanup     |
| Init command      | File locking in directory creation |
| Team mode         | Lockfile write conflicts           |
| Override commands | Config file locking                |
| Plugs CLI         | Multiple file access patterns      |

All skipped tests are covered by Unix CI runners. The core AlignTrue functionality (sync, export, validation) works correctly on Windows in production use.

## Recommended practices

1. **For CI/CD:** Prefer Unix-based runners (ubuntu-latest) for comprehensive test coverage
2. **For local development:** Windows works well for day-to-day usage
3. **For debugging:** If you encounter EBUSY errors, ensure all file handles are properly closed

## Reporting Windows-specific issues

If you encounter a Windows-specific issue not covered here:

1. Check if it's a known file locking issue
2. Try running the command again (transient locking often resolves)
3. Open an issue with the Windows version and error message

We aim to maintain Windows compatibility for all user-facing functionality while acknowledging test infrastructure limitations.
