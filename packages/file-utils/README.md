# @aligntrue/file-utils

**Safe, atomic file operations for the AlignTrue ecosystem.**

This package provides infrastructure utilities for safe file operations with atomic writes, checksum tracking, and rollback support.

## Purpose

AlignTrue needs deterministic, safe file operations across all components. This package centralizes file operation logic to ensure:

- **Atomicity:** Writes use temp + rename pattern (no partial states)
- **Safety:** Checksums detect manual edits before overwriting
- **Reliability:** Backup and rollback support for error recovery
- **Cross-platform:** Works identically on Windows, Linux, macOS

## Architecture

```
@aligntrue/file-utils (infrastructure)  ← This package
   ↓
@aligntrue/core + @aligntrue/exporters + CLI (consumers)
```

This package has **zero workspace dependencies** - it's pure Node.js utilities.

## Features

### Atomic File Writer

Safely write files with temp + rename pattern:

```typescript
import { AtomicFileWriter } from '@aligntrue/file-utils'

const writer = new AtomicFileWriter()

// Write atomically (uses temp file + rename)
await writer.write('/path/to/file.txt', 'content')

// Creates parent directories automatically
await writer.write('/path/nested/deep/file.txt', 'content')

// Tracks checksums to detect manual edits
writer.trackFile('/path/to/file.txt')
await writer.write('/path/to/file.txt', 'new content')  // Works

// Manually edit the file externally...
// Next write will throw error (overwrite protection)
await writer.write('/path/to/file.txt', 'more content')  // Throws!
```

### Checksum Utilities

Compute SHA-256 checksums for files and content:

```typescript
import { computeFileChecksum, computeContentChecksum } from '@aligntrue/file-utils'

// From file
const hash1 = computeFileChecksum('/path/to/file.txt')

// From string
const hash2 = computeContentChecksum('content string')

// Both produce hex SHA-256 (64 characters)
console.log(hash1)  // "a1b2c3d4..."
```

### Directory Creation

Ensure directories exist before writing:

```typescript
import { ensureDirectoryExists } from '@aligntrue/file-utils'

// Creates all parent directories if needed
ensureDirectoryExists('/path/to/nested/dir')

// Idempotent (safe to call multiple times)
ensureDirectoryExists('/existing/dir')

// Validates path is actually a directory
ensureDirectoryExists('/path/to/file.txt')  // Throws if file exists
```

## Usage

### Basic Write

```typescript
import { AtomicFileWriter } from '@aligntrue/file-utils'

const writer = new AtomicFileWriter()
await writer.write('.aligntrue/config.yaml', yamlContent)
```

### Overwrite Protection

```typescript
const writer = new AtomicFileWriter()

// Initial write
await writer.write('file.txt', 'original')

// Track for overwrite protection
writer.trackFile('file.txt')

// Safe: checksum matches
await writer.write('file.txt', 'updated')

// User manually edits file.txt...

// Detected: checksum mismatch
try {
  await writer.write('file.txt', 'more updates')
} catch (err) {
  console.log('File was manually edited!')
}
```

### Custom Checksum Handler

For interactive prompts (used by CLI):

```typescript
const writer = new AtomicFileWriter()

writer.setChecksumHandler(async (filePath, lastChecksum, currentChecksum, interactive, force) => {
  if (force) {
    return 'overwrite'  // --force flag
  }

  if (interactive) {
    // Prompt user: [o]verwrite [k]eep [a]bort
    const answer = await promptUser()
    return answer  // 'overwrite' | 'keep' | 'abort'
  }

  return 'abort'  // CI mode: fail on mismatch
})

await writer.write('file.txt', 'new content', { interactive: true })
```

### Rollback on Failure

```typescript
const writer = new AtomicFileWriter()

try {
  await writer.write('file1.txt', 'content1')
  await writer.write('file2.txt', 'content2')
  await writer.write('file3.txt', 'invalid')  // Fails
} catch (err) {
  writer.rollback()  // Restores file1 and file2 from backups
  throw err
}
```

## Security Guarantees

### Atomic Writes (Temp + Rename)

All writes use this pattern:

1. Write content to `/path/file.txt.tmp`
2. Atomically rename `/path/file.txt.tmp` → `/path/file.txt`
3. No partial states visible to other processes

**Why:** Operating systems guarantee atomic rename operations. If power fails during write, you either get the old file or the new file—never a corrupted partial file.

### Checksum Tracking

Detects manual edits between writes:

1. Write file, compute SHA-256 hash, store in memory
2. Before next write, recompute hash and compare
3. If mismatch, throw error (or call custom handler)

**Why:** Prevents accidentally overwriting user edits. Critical for `aligntrue sync --accept-agent` where users may manually edit agent files between syncs.

### Backup and Rollback

Before overwriting, creates `.backup` files:

1. Read original content
2. Write to `/path/file.txt.backup`
3. Proceed with atomic write
4. Delete backup on success

If any operation fails, `rollback()` restores from backups.

**Why:** Allows recovery from multi-file write failures. If writing 10 files and #7 fails, rollback restores files 1-6.

## API Reference

### `AtomicFileWriter`

```typescript
class AtomicFileWriter {
  // Write content atomically with optional overwrite protection
  async write(filePath: string, content: string, options?: {
    interactive?: boolean
    force?: boolean
  }): Promise<void>

  // Set custom handler for checksum mismatches
  setChecksumHandler(handler: (
    filePath: string,
    lastChecksum: string,
    currentChecksum: string,
    interactive: boolean,
    force: boolean
  ) => Promise<'overwrite' | 'keep' | 'abort'>): void

  // Track existing file's checksum for overwrite protection
  trackFile(filePath: string): void

  // Get checksum record for a file
  getChecksum(filePath: string): ChecksumRecord | undefined

  // Rollback writes by restoring from backups
  rollback(): void

  // Clear all tracked checksums and backups
  clear(): void
}

interface ChecksumRecord {
  filePath: string
  checksum: string
  timestamp: string
}
```

### Utility Functions

```typescript
// Compute SHA-256 checksum of file contents
function computeFileChecksum(filePath: string): string

// Compute SHA-256 checksum of string content
function computeContentChecksum(content: string): string

// Create directory and all parents (idempotent)
function ensureDirectoryExists(dirPath: string): void
```

## Testing

Run tests:

```bash
pnpm test
```

Tests cover:
- Atomic writes and temp file cleanup
- Checksum computation and tracking
- Overwrite protection and manual edit detection
- Backup creation and rollback
- Directory creation and validation
- Cross-platform path handling

## Why Separate Package?

File utilities are infrastructure primitives used by:
- `@aligntrue/core` (sync engine writes)
- `@aligntrue/exporters` (all 32 exporters)
- `@aligntrue/cli` (config and lockfile writes)
- Future: `@aligntrue/importers`, MCP server, etc.

Keeping them separate:
1. Avoids circular dependencies
2. Makes utilities easily testable in isolation
3. Enables reuse across all packages
4. Zero workspace dependencies = true infrastructure layer

## License

MIT

