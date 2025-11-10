/**
 * Tests for content hash-based change detection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ContentHashStrategy } from "../../src/tracking/content-hash-strategy.js";

describe("ContentHashStrategy", () => {
  let tempDir: string;
  let strategy: ContentHashStrategy;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));
    strategy = new ContentHashStrategy(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("is always available", async () => {
    expect(await strategy.isAvailable()).toBe(true);
  });

  it("detects all sections as new on first sync", async () => {
    const markdown = `
## Testing

Run tests before commit.

## Security

Never commit secrets.
`;
    writeFileSync(join(tempDir, "AGENTS.md"), markdown);

    const changes = await strategy.detectChanges("AGENTS.md");

    expect(changes.added).toHaveLength(2);
    expect(changes.modified).toHaveLength(0);
    expect(changes.unchanged).toHaveLength(0);
    expect(changes.removed).toHaveLength(0);
  });

  it("detects no changes when content is unchanged", async () => {
    const markdown = `
## Testing

Run tests before commit.
`;
    const filePath = "AGENTS.md";
    writeFileSync(join(tempDir, filePath), markdown);

    // First sync - save checkpoint
    const firstSync = await strategy.detectChanges(filePath);
    await strategy.saveCheckpoint(filePath, firstSync.added);

    // Second sync - no changes
    const secondSync = await strategy.detectChanges(filePath);

    expect(secondSync.added).toHaveLength(0);
    expect(secondSync.modified).toHaveLength(0);
    expect(secondSync.unchanged).toHaveLength(1);
    expect(secondSync.removed).toHaveLength(0);
  });

  it("detects modified sections", async () => {
    const originalMarkdown = `
## Testing

Run tests before commit.
`;
    const modifiedMarkdown = `
## Testing

Run tests and linting before commit.
`;
    const filePath = "AGENTS.md";
    const fullPath = join(tempDir, filePath);

    // First sync
    writeFileSync(fullPath, originalMarkdown);
    const firstSync = await strategy.detectChanges(filePath);
    await strategy.saveCheckpoint(filePath, firstSync.added);

    // Modify content
    writeFileSync(fullPath, modifiedMarkdown);
    const secondSync = await strategy.detectChanges(filePath);

    expect(secondSync.added).toHaveLength(0);
    expect(secondSync.modified).toHaveLength(1);
    expect(secondSync.modified[0]!.heading).toBe("Testing");
    expect(secondSync.unchanged).toHaveLength(0);
    expect(secondSync.removed).toHaveLength(0);
  });

  it("detects added sections", async () => {
    const originalMarkdown = `
## Testing

Run tests before commit.
`;
    const expandedMarkdown = `
## Testing

Run tests before commit.

## Security

Never commit secrets.
`;
    const filePath = "AGENTS.md";
    const fullPath = join(tempDir, filePath);

    // First sync
    writeFileSync(fullPath, originalMarkdown);
    const firstSync = await strategy.detectChanges(filePath);
    await strategy.saveCheckpoint(filePath, firstSync.added);

    // Add new section
    writeFileSync(fullPath, expandedMarkdown);
    const secondSync = await strategy.detectChanges(filePath);

    expect(secondSync.added).toHaveLength(1);
    expect(secondSync.added[0]!.heading).toBe("Security");
    expect(secondSync.modified).toHaveLength(0);
    expect(secondSync.unchanged).toHaveLength(1);
    expect(secondSync.removed).toHaveLength(0);
  });

  it("detects removed sections", async () => {
    const originalMarkdown = `
## Testing

Run tests before commit.

## Security

Never commit secrets.
`;
    const reducedMarkdown = `
## Testing

Run tests before commit.
`;
    const filePath = "AGENTS.md";
    const fullPath = join(tempDir, filePath);

    // First sync
    writeFileSync(fullPath, originalMarkdown);
    const firstSync = await strategy.detectChanges(filePath);
    await strategy.saveCheckpoint(filePath, firstSync.added);

    // Remove section
    writeFileSync(fullPath, reducedMarkdown);
    const secondSync = await strategy.detectChanges(filePath);

    expect(secondSync.added).toHaveLength(0);
    expect(secondSync.modified).toHaveLength(0);
    expect(secondSync.unchanged).toHaveLength(1);
    expect(secondSync.removed).toHaveLength(1);
  });

  it("detects complex changes", async () => {
    const originalMarkdown = `
## Testing

Run tests.

## Security

No secrets.

## Performance

Optimize code.
`;
    const modifiedMarkdown = `
## Testing

Run all tests with coverage.

## Deployment

Deploy to staging first.

## Performance

Optimize code.
`;
    const filePath = "AGENTS.md";
    const fullPath = join(tempDir, filePath);

    // First sync
    writeFileSync(fullPath, originalMarkdown);
    const firstSync = await strategy.detectChanges(filePath);
    await strategy.saveCheckpoint(filePath, firstSync.added);

    // Complex changes: modify Testing, add Deployment, remove Security, keep Performance
    writeFileSync(fullPath, modifiedMarkdown);
    const secondSync = await strategy.detectChanges(filePath);

    expect(secondSync.added).toHaveLength(1); // Deployment
    expect(secondSync.added[0]!.heading).toBe("Deployment");
    expect(secondSync.modified).toHaveLength(1); // Testing
    expect(secondSync.modified[0]!.heading).toBe("Testing");
    expect(secondSync.unchanged).toHaveLength(1); // Performance
    expect(secondSync.unchanged[0]!.heading).toBe("Performance");
    expect(secondSync.removed).toHaveLength(1); // Security
  });

  it("returns empty result for non-existent file", async () => {
    const changes = await strategy.detectChanges("non-existent.md");

    expect(changes.added).toHaveLength(0);
    expect(changes.modified).toHaveLength(0);
    expect(changes.unchanged).toHaveLength(0);
    expect(changes.removed).toHaveLength(0);
  });
});
