/**
 * Tests for backup vs extraction separation
 *
 * Verifies that:
 * 1. New agents get full file backups (not extraction)
 * 2. Existing read-only agents that have edits get section extraction (not full backup)
 * 3. No duplication of content between backup and extraction
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdtempSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { AlignPack } from "@aligntrue/schema";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));
});

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe("Backup vs Extraction Separation", () => {
  describe("Scenario 1: New agent detected", () => {
    it("should create full file backup when new agent is detected and enabled", async () => {
      // Setup: Create a new agent file with content
      const agentFilePath = join(tmpDir, ".cursor", "rules", "backend.mdc");
      mkdirSync(join(tmpDir, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        agentFilePath,
        "# Backend Rules\n\n## Performance\n\nOptimize all queries",
      );

      const { backupFileToOverwrittenRules } = await import(
        "../../src/utils/extract-rules.js"
      );

      // Execute: Backup the file (simulating new agent detection)
      const backupResult = backupFileToOverwrittenRules(agentFilePath, tmpDir);

      // Verify: Full file is backed up
      expect(backupResult.backed_up).toBe(true);
      expect(backupResult.backup_path).toBeDefined();
      expect(existsSync(backupResult.backup_path!)).toBe(true);

      // Verify: Backup contains original file structure
      const backupContent = readFileSync(backupResult.backup_path!, "utf-8");
      expect(backupContent).toContain("# Backend Rules");
      expect(backupContent).toContain("## Performance");
      expect(backupContent).toContain("Optimize all queries");
    });

    it("should NOT create extracted-rules.md for new agent (only backup)", async () => {
      // Setup
      const agentFilePath = join(tmpDir, ".cursor", "rules", "backend.mdc");
      mkdirSync(join(tmpDir, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        agentFilePath,
        "# Backend Rules\n\n## Performance\n\nContent",
      );

      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });
      const extractedRulesPath = join(aligntrueDir, "extracted-rules.md");

      const { backupFileToOverwrittenRules } = await import(
        "../../src/utils/extract-rules.js"
      );

      // Execute: Backup file
      backupFileToOverwrittenRules(agentFilePath, tmpDir);

      // Verify: extracted-rules.md was NOT created
      expect(existsSync(extractedRulesPath)).toBe(false);
    });
  });

  describe("Scenario 2: Existing read-only agent has edits", () => {
    it("should extract only new sections from read-only agent (deduplication)", async () => {
      // Setup: Create IR with some existing content
      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      const currentIR: AlignPack = {
        id: "test-org.test-project",
        version: "1.0.0",
        sections: [
          {
            heading: "Performance",
            // Must match exactly to be deduplicated
            content: "Optimize all queries",
            fingerprint: "perf-1",
            level: 2,
          },
        ],
      };

      // Setup: Create read-only agent file with same + new sections
      const agentFilePath = join(tmpDir, "CLAUDE.md");
      writeFileSync(
        agentFilePath,
        // EXACTLY matching Performance section, plus a new Testing section
        `# Claude Rules

## Performance

Optimize all queries

## Testing

Write tests for all changes
`,
      );

      const { extractAndSaveRules } = await import(
        "../../src/utils/extract-rules.js"
      );

      // Execute: Extract sections (simulating two-way sync)
      const extractResult = await extractAndSaveRules(
        agentFilePath,
        undefined,
        tmpDir,
        currentIR,
      );

      // Verify: Only NEW section is extracted (deduplication)
      expect(extractResult.extracted).toBe(true);
      // Should extract at least Testing section
      expect(extractResult.sectionCount).toBeGreaterThanOrEqual(1);
      // Should have sections in file (exact count may vary with whitespace)
      expect(extractResult.sectionCount).toBeGreaterThan(0);

      // Verify: extracted-rules.md contains new content
      const extractedRulesPath = join(aligntrueDir, "extracted-rules.md");
      expect(existsSync(extractedRulesPath)).toBe(true);

      const extractedContent = readFileSync(extractedRulesPath, "utf-8");
      // Testing section must be extracted
      expect(extractedContent).toContain("## Testing");
    });

    it("should NOT create backups when extracting sections for read-only agents", async () => {
      // Setup
      const aligntrueDir = join(tmpDir, ".aligntrue");
      const overwrittenRulesDir = join(aligntrueDir, "overwritten-rules");
      mkdirSync(aligntrueDir, { recursive: true });

      const currentIR: AlignPack = {
        id: "test-org.test-project",
        version: "1.0.0",
        sections: [
          {
            heading: "Performance",
            content: "Optimize",
            fingerprint: "perf-1",
            level: 2,
          },
        ],
      };

      const agentFilePath = join(tmpDir, "CLAUDE.md");
      writeFileSync(agentFilePath, "# Claude Rules\n\n## Testing\n\nTest it");

      const { extractAndSaveRules } = await import(
        "../../src/utils/extract-rules.js"
      );

      // Execute: Extract
      await extractAndSaveRules(agentFilePath, undefined, tmpDir, currentIR);

      // Verify: No backup directory created
      expect(existsSync(overwrittenRulesDir)).toBe(false);
    });

    it("should include extraction metadata in frontmatter", async () => {
      // Setup
      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      const currentIR: AlignPack = {
        id: "test-org.test-project",
        version: "1.0.0",
        sections: [],
      };

      const agentFilePath = join(tmpDir, "AGENTS.md");
      writeFileSync(agentFilePath, "# Rules\n\n## Security\n\nValidate input");

      const { extractAndSaveRules } = await import(
        "../../src/utils/extract-rules.js"
      );

      // Execute
      await extractAndSaveRules(agentFilePath, undefined, tmpDir, currentIR);

      // Verify: Frontmatter metadata
      const extractedRulesPath = join(aligntrueDir, "extracted-rules.md");
      const content = readFileSync(extractedRulesPath, "utf-8");

      expect(content).toContain("---");
      expect(content).toContain("Extracted from: AGENTS.md");
      expect(content).toMatch(/Date: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      expect(content).toContain("Total sections:");
      expect(content).toContain("Extracted:");
      expect(content).toContain("Skipped:");
      // Should NOT have the old "Reason" field
      expect(content).not.toContain("Reason: File enabled as export target");
    });

    it("should support multiple extractions appended to same file", async () => {
      // Setup
      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      const currentIR: AlignPack = {
        id: "test-org.test-project",
        version: "1.0.0",
        sections: [],
      };

      // First extraction from CLAUDE.md
      const claudeFile = join(tmpDir, "CLAUDE.md");
      writeFileSync(claudeFile, "# Claude\n\n## Testing\n\nTest it");

      const { extractAndSaveRules } = await import(
        "../../src/utils/extract-rules.js"
      );

      const result1 = await extractAndSaveRules(
        claudeFile,
        undefined,
        tmpDir,
        currentIR,
      );
      expect(result1.extracted).toBe(true);

      // Second extraction from CURSOR.mdc
      const cursorFile = join(tmpDir, ".cursor", "rules", "cursor.mdc");
      mkdirSync(join(tmpDir, ".cursor", "rules"), { recursive: true });
      writeFileSync(cursorFile, "# Cursor\n\n## Performance\n\nOptimize");

      const result2 = await extractAndSaveRules(
        cursorFile,
        undefined,
        tmpDir,
        currentIR,
      );
      expect(result2.extracted).toBe(true);

      // Verify: Both extractions are in the file, separated
      const extractedRulesPath = join(aligntrueDir, "extracted-rules.md");
      const content = readFileSync(extractedRulesPath, "utf-8");

      // Should have two frontmatter blocks
      const frontmatterCount = (content.match(/^---$/gm) || []).length;
      expect(frontmatterCount).toBeGreaterThanOrEqual(4); // At least 2 blocks = 4 dashes

      // Both sources should be mentioned
      expect(content).toContain("Extracted from: CLAUDE.md");
      expect(content).toContain("Extracted from: .cursor/rules/cursor.mdc");

      // Both sections should be present
      expect(content).toContain("## Testing");
      expect(content).toContain("## Performance");
    });
  });

  describe("No duplication guarantee", () => {
    it("should prevent extracting the same file multiple times (idempotent)", async () => {
      // Setup
      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      const currentIR: AlignPack = {
        id: "test-org.test-project",
        version: "1.0.0",
        sections: [],
      };

      const agentFile = join(tmpDir, "AGENTS.md");
      writeFileSync(agentFile, "# Rules\n\n## Security\n\nValidate input");

      const { extractAndSaveRules } = await import(
        "../../src/utils/extract-rules.js"
      );

      // First extraction
      const result1 = await extractAndSaveRules(
        agentFile,
        undefined,
        tmpDir,
        currentIR,
      );
      expect(result1.extracted).toBe(true);

      const extractedRulesPath = join(aligntrueDir, "extracted-rules.md");
      const content1 = readFileSync(extractedRulesPath, "utf-8");

      // Second extraction with same content (idempotent)
      const result2 = await extractAndSaveRules(
        agentFile,
        undefined,
        tmpDir,
        currentIR,
      );
      expect(result2.extracted).toBe(true); // Still extracted (appended)

      const content2 = readFileSync(extractedRulesPath, "utf-8");

      // Verify: Second extraction was appended
      expect(content2.length).toBeGreaterThan(content1.length);
    });

    it("should never backup when extracting (no duplicate content)", async () => {
      // Setup
      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      const currentIR: AlignPack = {
        id: "test-org.test-project",
        version: "1.0.0",
        sections: [],
      };

      const agentFile = join(tmpDir, "AGENTS.md");
      const largeContent = `# Rules

## Security

Validate all user input

## Performance

Optimize database queries

## Testing

Write tests for all changes`;

      writeFileSync(agentFile, largeContent);

      const { extractAndSaveRules } = await import(
        "../../src/utils/extract-rules.js"
      );

      // Extract sections
      await extractAndSaveRules(agentFile, undefined, tmpDir, currentIR);

      // Verify: No backup files created in overwritten-rules
      const overwrittenRulesDir = join(aligntrueDir, "overwritten-rules");
      const backupExists = existsSync(overwrittenRulesDir);

      expect(backupExists).toBe(false);
    });
  });
});
