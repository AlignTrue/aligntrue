# ADR 002: Hash-Based Agent Drift Detection

## Status

Accepted

## Context

We need to detect when an agent file (e.g., `AGENTS.md`) has been manually edited by a user after it was last synced from the AlignTrue IR. This allows us to prompt the user to run `aligntrue sync --accept-agent` to pull those changes back into the canonical IR.

Initially, we implemented this using file modification timestamps (`mtime`) compared against a `.last-sync` timestamp file. However, this proved unreliable across different operating systems and CI environments due to:

- Filesystem timestamp precision differences (e.g., FAT32 2s vs ext4 ns)
- Race conditions during rapid test execution
- Copy/paste operations preserving or resetting timestamps inconsistently
- Clock skew in some environments

We spent significant effort debugging these timestamp issues without achieving 100% reliability.

## Decision

We will replace timestamp-based drift detection with **content hash comparison**, similar to how Git, npm, and Docker detect changes.

### Mechanism

1. When `aligntrue sync` exports files to agents, we compute the SHA-256 hash of the exported content.
2. These hashes are stored in `.aligntrue/.agent-export-hashes.json`.
3. When `aligntrue drift` runs, it reads the current agent files, computes their SHA-256 hash, and compares it to the stored hash.
4. If the hashes differ, drift is reported.

### Special Handling

- When running `aligntrue sync --accept-agent`, we update the stored hash to match the currently accepted file content, as this file is now considered "in sync" with the IR.

## Consequences

### Positive

- **Deterministic:** Same content always produces same hash, eliminating flakiness.
- **Cross-platform:** Works identically on Windows, macOS, Linux, and CI.
- **Robust:** Handles copy/paste, file replacement, and manual edits correctly regardless of how they affect timestamps.
- **Simpler Code:** Removes complex fallback logic, retry loops, and filesystem-specific workarounds.

### Negative

- **Performance:** Requires reading and hashing agent files on every drift check. Since agent files are typically small markdown files, this overhead is negligible.
- **Storage:** Introduces a new tracking file `.aligntrue/.agent-export-hashes.json`.

## References

- Similar approach used by `package-lock.json` / `pnpm-lock.yaml` integrity fields.
- Git's content-addressable storage model.
