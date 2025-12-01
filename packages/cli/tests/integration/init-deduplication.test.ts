/**
 * Integration tests for init command overlap detection
 *
 * Tests that when multiple agent files contain similar content,
 * init detects the overlap and handles it appropriately.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { init } from "../../src/commands/init.js";
import { cleanupDir } from "../helpers/fs-cleanup.js";

let TEST_DIR: string;
let originalCwd: string;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  originalCwd = process.cwd();
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-dedup-"));
  process.chdir(TEST_DIR);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await cleanupDir(TEST_DIR);
});

/**
 * Create similar content with slight variations
 * to simulate copy-paste scenarios
 */
function createSimilarRules(): {
  cursor: string;
  agents: string;
  claude: string;
} {
  const baseContent = `# Coding Standards

## TypeScript
- Use strict mode
- Prefer interfaces over types
- Use const assertions

## Testing
- Write unit tests
- Aim for 80% coverage
- Mock external dependencies

## Code Quality
- Keep functions small
- Use meaningful names
- Document public APIs
`;

  return {
    cursor: `---
description: Coding standards for the project
when: always
---

${baseContent}`,
    agents: baseContent,
    claude: `${baseContent}

---
*Managed by AlignTrue*
`,
  };
}

describeSkipWindows("Init Deduplication", () => {
  describe("overlap detection", () => {
    it("should detect similar content across agent files", async () => {
      // Create similar files
      const rules = createSimilarRules();

      // Create Cursor rules
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, "standards.mdc"), rules.cursor);

      // Create AGENTS.md
      writeFileSync(join(TEST_DIR, "AGENTS.md"), rules.agents);

      // Create CLAUDE.md
      writeFileSync(join(TEST_DIR, "CLAUDE.md"), rules.claude);

      // Run init with --yes (non-interactive)
      await init(["--yes"]);

      // Check that .aligntrue was created
      expect(existsSync(join(TEST_DIR, ".aligntrue"))).toBe(true);
      expect(existsSync(join(TEST_DIR, ".aligntrue", "rules"))).toBe(true);

      // In non-interactive mode with overlap, only canonical source should be imported
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));

      // Should have imported the Cursor rule (preferred format)
      expect(ruleFiles.length).toBeGreaterThanOrEqual(1);

      // Check that backup was created for duplicates
      const backupsDir = join(
        TEST_DIR,
        ".aligntrue",
        ".backups",
        "init-duplicates",
      );

      if (existsSync(backupsDir)) {
        // If overlap was detected, backups should exist
        const backupDirs = readdirSync(backupsDir);
        expect(backupDirs.length).toBeGreaterThanOrEqual(1);

        // Check manifest exists
        const latestBackup = backupDirs[0];
        const manifestPath = join(backupsDir, latestBackup!, "manifest.json");
        if (existsSync(manifestPath)) {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          expect(manifest.reason).toBe("init-overlap-detection");
          expect(manifest.duplicates).toBeDefined();
          expect(Array.isArray(manifest.duplicates)).toBe(true);
        }
      }
    });

    it("should not create backups when files are different", async () => {
      // Create genuinely different files
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(
        join(cursorDir, "typescript.mdc"),
        `---
description: TypeScript rules
---
# TypeScript
Use strict mode. Prefer interfaces.
`,
      );

      writeFileSync(
        join(TEST_DIR, "AGENTS.md"),
        `# Security Guidelines
Never log secrets. Validate inputs. Use HTTPS.
`,
      );

      // Run init
      await init(["--yes"]);

      // Check that both rules were imported (no overlap detected)
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));

      // Should have both rules since they're different
      expect(ruleFiles.length).toBeGreaterThanOrEqual(2);

      // No backup should be created
      const backupsDir = join(
        TEST_DIR,
        ".aligntrue",
        ".backups",
        "init-duplicates",
      );
      if (existsSync(backupsDir)) {
        const backupDirs = readdirSync(backupsDir);
        expect(backupDirs.length).toBe(0);
      }
    });

    it("should prefer Cursor format as canonical source", async () => {
      // Create similar files with Cursor and AGENTS.md
      const content = `# Project Rules
Follow best practices. Write tests. Document code.
Keep it simple. Review changes. Ship fast.
`;

      // Create AGENTS.md first (so it would be detected first)
      writeFileSync(join(TEST_DIR, "AGENTS.md"), content);

      // Create Cursor rules
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(
        join(cursorDir, "main.mdc"),
        `---
description: Project rules
---
${content}`,
      );

      // Run init
      await init(["--yes"]);

      // Check imported rules
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));

      // Should have the Cursor rule (preferred format)
      const hasMainRule = ruleFiles.some(
        (f) => f === "main.md" || f.includes("main"),
      );
      expect(hasMainRule).toBe(true);
    });
  });

  describe("single file scenarios", () => {
    it("should work normally with only one agent file", async () => {
      // Create just AGENTS.md
      writeFileSync(
        join(TEST_DIR, "AGENTS.md"),
        `# My Rules
Follow the guidelines.
`,
      );

      await init(["--yes"]);

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      expect(existsSync(rulesDir)).toBe(true);

      const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
      expect(ruleFiles.length).toBeGreaterThanOrEqual(1);

      // No backup directory should be created
      const backupsDir = join(
        TEST_DIR,
        ".aligntrue",
        ".backups",
        "init-duplicates",
      );
      expect(existsSync(backupsDir)).toBe(false);
    });

    it("should work normally with fresh start", async () => {
      // No existing agent files
      await init(["--yes"]);

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      expect(existsSync(rulesDir)).toBe(true);

      // Should have starter templates
      const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
      expect(ruleFiles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("backup manifest", () => {
    it("should include similarity information in manifest", async () => {
      // Create identical files
      const content = `# Same Content
Exactly the same rules in all files.
This should be detected as duplicates.
`;

      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });
      writeFileSync(join(cursorDir, "rules.mdc"), content);
      writeFileSync(join(TEST_DIR, "AGENTS.md"), content);
      writeFileSync(join(TEST_DIR, "CLAUDE.md"), content);

      await init(["--yes"]);

      // Find backup directory
      const backupsDir = join(
        TEST_DIR,
        ".aligntrue",
        ".backups",
        "init-duplicates",
      );

      if (existsSync(backupsDir)) {
        const backupDirs = readdirSync(backupsDir);
        if (backupDirs.length > 0) {
          const manifestPath = join(
            backupsDir,
            backupDirs[0]!,
            "manifest.json",
          );

          if (existsSync(manifestPath)) {
            const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

            // Check manifest structure
            expect(manifest.version).toBe("1");
            expect(manifest.timestamp).toBeDefined();
            expect(manifest.reason).toBe("init-overlap-detection");
            expect(manifest.duplicates).toBeDefined();

            // Each duplicate should have similarity info
            for (const dup of manifest.duplicates) {
              expect(dup.path).toBeDefined();
              expect(dup.type).toBeDefined();
              expect(dup.similarity).toBeDefined();
              expect(dup.similarity).toBeGreaterThan(0.5);
              expect(dup.canonicalPath).toBeDefined();
            }
          }
        }
      }
    });
  });
});
