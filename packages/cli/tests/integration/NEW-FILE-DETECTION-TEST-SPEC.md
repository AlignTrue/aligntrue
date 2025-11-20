# New File Detection Test Specification

This document outlines the integration tests that should be created for the new file detection feature.

## Test Files to Create

### 1. `sync-new-file-detection.test.ts`

**Purpose:** Test that `aligntrue sync` detects untracked files with content and prompts appropriately.

**Scenarios:**

#### Test: Detects single new file with content

```typescript
test("detects single new file with content and prompts for import", async () => {
  // Setup: init project with AGENTS.md
  // Add: CLAUDE.md with 5 sections
  // Run: aligntrue sync (non-interactive with --yes)
  // Assert:
  //   - CLAUDE.md detected
  //   - Content merged into AGENTS.md
  //   - edit_source updated to include CLAUDE.md
  //   - .cursor/rules/aligntrue.mdc includes CLAUDE content
});
```

#### Test: Detects multiple new files across formats

```typescript
test("detects multiple new files from different agents", async () => {
  // Setup: init project with AGENTS.md
  // Add: CLAUDE.md, GEMINI.md, .cursor/rules/backend.mdc
  // Run: aligntrue sync --yes
  // Assert:
  //   - All 3 files detected
  //   - All content merged
  //   - edit_source includes all patterns
  //   - Section count in output = sum of all inputs
});
```

#### Test: Ignores empty files

```typescript
test("ignores files with no content or sections", async () => {
  // Setup: init project
  // Add: empty CLAUDE.md (no content)
  // Add: GEMINI.md with text but no headings
  // Run: aligntrue sync
  // Assert:
  //   - No detection prompt shown
  //   - Files not added to edit_source
});
```

#### Test: Detects files in subdirectories

```typescript
test("detects cursor mdc files in .cursor/rules/", async () => {
  // Setup: init project
  // Add: .cursor/rules/backend.mdc
  // Add: .cursor/rules/frontend.mdc
  // Add: .cursor/rules/testing.mdc
  // Run: aligntrue sync --yes
  // Assert:
  //   - All 3 files detected
  //   - Pattern ".cursor/rules/*.mdc" added to edit_source
  //   - All content merged
});
```

### 2. `multi-source-merge.test.ts`

**Purpose:** Test merge quality when importing multiple sources.

**Scenarios:**

#### Test: Merges all sections from all sources

```typescript
test("includes all sections from all source files", async () => {
  // Setup: init with AGENTS.md (10 sections)
  // Add: CLAUDE.md (5 sections, all unique)
  // Run: sync
  // Assert:
  //   - Output has exactly 15 sections
  //   - All section headings present
  //   - No sections lost
});
```

#### Test: Last-write-wins for duplicate sections

```typescript
test("uses last-write-wins for duplicate section headings", async () => {
  // Setup: AGENTS.md with "## Security" section (content: "A")
  // Add: CLAUDE.md with "## Security" section (content: "B", newer mtime)
  // Run: sync
  // Assert:
  //   - Output has 1 "Security" section
  //   - Content is "B" (from CLAUDE.md)
  //   - Conflict warning shown in output
});
```

#### Test: Proper formatting with horizontal rules

```typescript
test("normalizes markdown formatting issues", async () => {
  // Setup: AGENTS.md with "---### Heading" (no newline)
  // Run: sync
  // Assert:
  //   - Output has "---\n\n### Heading"
  //   - No malformed horizontal rules
  //   - Proper spacing throughout
});
```

#### Test: Source attribution in output

```typescript
test("adds source attribution comments to merged output", async () => {
  // Setup: init with AGENTS.md
  // Add: CLAUDE.md, GEMINI.md
  // Run: sync
  // Assert:
  //   - Output contains: <!-- Synced from: AGENTS.md, CLAUDE.md, GEMINI.md -->
  //   - Timestamp present in comment
  //   - Comment at appropriate location
});
```

### 3. `watch-new-files.test.ts`

**Purpose:** Test watch mode behavior with new file detection.

**Scenarios:**

#### Test: Watch logs new files without auto-importing

```typescript
test("watch mode logs new files but doesn't auto-import", async () => {
  // Setup: init project, start watch
  // Action: add CLAUDE.md while watch running
  // Assert:
  //   - Watch output shows: "New file detected: CLAUDE.md"
  //   - Drift log created with pending_review status
  //   - File NOT added to edit_source
  //   - No sync triggered
  //   - User message: "Run 'aligntrue sync' to review"
});
```

#### Test: Drift log persists after watch stops

```typescript
test("drift log persists across watch sessions", async () => {
  // Setup: start watch, detect new file, stop watch
  // Action: restart watch
  // Assert:
  //   - .aligntrue/.drift-log.json still exists
  //   - Detection still marked pending_review
  //   - Next sync shows pending imports
});
```

#### Test: Auto-import mode (opt-in)

```typescript
test("auto-imports new files when configured", async () => {
  // Setup: config.yaml with watch.on_new_files: "auto_import"
  // Action: start watch, add CLAUDE.md
  // Assert:
  //   - File auto-imported without prompt
  //   - Added to edit_source
  //   - Sync triggered automatically
  //   - Content merged
});
```

### 4. `drift-log.test.ts`

**Purpose:** Test drift log functionality.

**Scenarios:**

#### Test: Drift log creation

```typescript
test("creates drift log on first detection", async () => {
  // Setup: init project
  // Add: untracked file CLAUDE.md
  // Run: sync
  // Assert:
  //   - .aligntrue/.drift-log.json created
  //   - Contains detection entry
  //   - Status: "pending_review"
});
```

#### Test: Drift log updates on import

```typescript
test("updates drift log status when file imported", async () => {
  // Setup: drift log with pending detection
  // Action: sync and import file
  // Assert:
  //   - Status updated to "imported"
  //   - Timestamp updated
  //   - File path matches
});
```

#### Test: Drift log prevents duplicates

```typescript
test("doesn't duplicate detections across multiple syncs", async () => {
  // Setup: untracked file detected
  // Action: run sync twice (ignore both times)
  // Assert:
  //   - Drift log has only 1 entry
  //   - Timestamp updates on second sync
  //   - No duplication
});
```

### 5. `prompts.test.ts`

**Purpose:** Test interactive prompt behavior.

**Scenarios:**

#### Test: Import and merge prompt

```typescript
test("prompts with comprehensive drift report", async () => {
  // Setup: Multiple untracked files with different section counts
  // Run: sync (capture prompt output)
  // Assert:
  //   - Shows file paths
  //   - Shows section counts
  //   - Shows last modified times
  //   - Offers 3 options: import_and_merge, import_readonly, ignore
  //   - Default is import_and_merge
});
```

#### Test: Merge strategy prompt

```typescript
test("prompts for merge strategy when importing multiple sources", async () => {
  // Setup: 3 new files detected
  // Action: choose "import_and_merge"
  // Assert:
  //   - Shows list of files being merged
  //   - Asks: "Merge all rules into one shared set?"
  //   - Default is "yes"
});
```

#### Test: Duplicate section warning

```typescript
test("shows duplicate section warnings during merge", async () => {
  // Setup: Two files with same section heading
  // Run: sync
  // Assert:
  //   - Warning shown: "Found potential duplicate sections"
  //   - Lists: section name and source files
  //   - Notes: "Using last-write-wins strategy"
});
```

## Test Utilities Needed

### Helpers

```typescript
// Test setup helpers
function createTestProject(options?: { mode: "solo" | "team" }): string;
function writeAgentFile(
  path: string,
  sections: Array<{ heading: string; content: string }>,
): void;
function setFileModifiedTime(path: string, date: Date): void;

// Assertion helpers
function assertSectionCount(filePath: string, expectedCount: number): void;
function assertSectionExists(filePath: string, heading: string): void;
function assertSourceAttribution(filePath: string, sources: string[]): void;
function assertEditSourceIncludes(configPath: string, pattern: string): void;

// Drift log helpers
function getDriftLogDetections(cwd: string): DriftDetection[];
function assertDriftLogStatus(
  cwd: string,
  file: string,
  status: DriftStatus,
): void;
```

### Fixtures

Create fixture files in `packages/cli/tests/fixtures/`:

- `sample-agents.md` - Standard AGENTS.md with 10 sections
- `sample-claude.md` - CLAUDE.md with 5 sections
- `sample-cursor-backend.mdc` - Cursor file with 8 sections
- `malformed-formatting.md` - File with formatting issues (---### pattern)
- `duplicate-sections.md` - File with sections that duplicate sample-agents.md

## Running the Tests

```bash
# Run all new file detection tests
pnpm --filter @aligntrue/cli test sync-new-file-detection

# Run all merge tests
pnpm --filter @aligntrue/cli test multi-source-merge

# Run watch tests
pnpm --filter @aligntrue/cli test watch-new-files

# Run all integration tests
pnpm --filter @aligntrue/cli test
```

## Expected Coverage

After implementing these tests, we should have coverage for:

- ✅ Content-aware file detection
- ✅ Interactive prompts (all options)
- ✅ Multi-file merge (complete, no missing sections)
- ✅ Last-write-wins conflict resolution
- ✅ Source attribution
- ✅ Formatting normalization
- ✅ Drift log creation and updates
- ✅ Watch mode new file detection
- ✅ Watch mode logging (no auto-import by default)
- ✅ edit_source configuration updates
- ✅ All scenarios from plan Phase 7

## Implementation Priority

1. **High Priority (blocking):**
   - `sync-new-file-detection.test.ts` - Core functionality
   - `multi-source-merge.test.ts` - Merge quality

2. **Medium Priority (important for safety):**
   - `drift-log.test.ts` - State persistence
   - `watch-new-files.test.ts` - Watch mode safety

3. **Lower Priority (UX polish):**
   - `prompts.test.ts` - Prompt quality

## Notes for Implementation

- Use real file operations (no mocks) as per AlignTrue testing philosophy
- Tests should be deterministic (fixed mtimes, stable ordering)
- Clean up test directories after each test
- Use fixtures for complex content to keep tests readable
- Test both `--yes` (non-interactive) and interactive modes where applicable
