/**
 * Import structure preservation tests
 * Tests that aligntrue add preserves filenames and directory structure
 * during import from local and remote sources
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  rmSync,
  readFileSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEST_DIR = join(__dirname, "../../../temp-test-import");
const CLI_PATH = join(__dirname, "../../dist/index.js");

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describeSkipWindows("Import Structure Preservation", () => {
  beforeEach(() => {
    // Clean and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("Local import", () => {
    it("should preserve directory structure when importing from local path", () => {
      // Create source directory with nested structure
      const sourceDir = join(TEST_DIR, "source-rules");
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(join(sourceDir, "backend"), { recursive: true });
      mkdirSync(join(sourceDir, "frontend"), { recursive: true });

      // Create rule files
      writeFileSync(
        join(sourceDir, "global.md"),
        "# Global Rule\n\nGlobal guidelines",
      );
      writeFileSync(
        join(sourceDir, "backend", "security.md"),
        "# Backend Security\n\nSecurity guidelines",
      );
      writeFileSync(
        join(sourceDir, "backend", "performance.md"),
        "# Backend Performance\n\nPerformance guidelines",
      );
      writeFileSync(
        join(sourceDir, "frontend", "react.md"),
        "# React Guidelines\n\nReact best practices",
      );

      // Create project and initialize
      const projectDir = join(TEST_DIR, "project");
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(join(projectDir, ".aligntrue"), { recursive: true });

      writeFileSync(
        join(projectDir, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - agents
`,
        "utf-8",
      );

      // Run add command
      execSync(`node "${CLI_PATH}" add "${sourceDir}" --yes`, {
        cwd: projectDir,
        stdio: "pipe",
      });

      // Verify structure is preserved
      const rulesDir = join(projectDir, ".aligntrue/rules");
      expect(existsSync(join(rulesDir, "global.md"))).toBe(true);
      expect(existsSync(join(rulesDir, "backend", "security.md"))).toBe(true);
      expect(existsSync(join(rulesDir, "backend", "performance.md"))).toBe(
        true,
      );
      expect(existsSync(join(rulesDir, "frontend", "react.md"))).toBe(true);

      // Verify filenames are preserved
      const globalContent = readFileSync(join(rulesDir, "global.md"), "utf-8");
      expect(globalContent).toContain("Global Rule");

      const backendSecurityContent = readFileSync(
        join(rulesDir, "backend", "security.md"),
        "utf-8",
      );
      expect(backendSecurityContent).toContain("Backend Security");
    });

    it("should preserve original filename when importing", () => {
      // Create source directory
      const sourceDir = join(TEST_DIR, "source-names");
      mkdirSync(sourceDir, { recursive: true });

      // Create file with specific name
      writeFileSync(
        join(sourceDir, "security-guidelines.md"),
        "# Security\n\nGuidelines",
      );

      // Create project
      const projectDir = join(TEST_DIR, "project");
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(join(projectDir, ".aligntrue"), { recursive: true });

      writeFileSync(
        join(projectDir, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - agents
`,
        "utf-8",
      );

      // Run add command
      execSync(`node "${CLI_PATH}" add "${sourceDir}" --yes`, {
        cwd: projectDir,
        stdio: "pipe",
      });

      // Verify original filename is preserved
      const rulesDir = join(projectDir, ".aligntrue/rules");
      expect(existsSync(join(rulesDir, "security-guidelines.md"))).toBe(true);

      // Verify it's the exact same filename
      const files = readdirSync(rulesDir);
      expect(files).toContain("security-guidelines.md");
    });

    it("should convert .mdc files to .md while preserving structure", () => {
      // Create source directory with .mdc files
      const sourceDir = join(TEST_DIR, "source-mdc");
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(join(sourceDir, "cursor"), { recursive: true });

      // Create .mdc file with frontmatter
      writeFileSync(
        join(sourceDir, "cursor", "rule.mdc"),
        `---
title: Cursor Rule
---

# Cursor Rule

Some cursor guidance`,
      );

      // Create project
      const projectDir = join(TEST_DIR, "project");
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(join(projectDir, ".aligntrue"), { recursive: true });

      writeFileSync(
        join(projectDir, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - agents
`,
        "utf-8",
      );

      // Run add command
      execSync(`node "${CLI_PATH}" add "${sourceDir}" --yes`, {
        cwd: projectDir,
        stdio: "pipe",
      });

      // Verify .mdc is converted to .md but structure preserved
      const rulesDir = join(projectDir, ".aligntrue/rules");
      expect(existsSync(join(rulesDir, "cursor", "rule.md"))).toBe(true);

      const content = readFileSync(
        join(rulesDir, "cursor", "rule.md"),
        "utf-8",
      );
      expect(content).toContain("Cursor Rule");
    });
  });

  describe("Export structure preservation", () => {
    it("should preserve rule subdirectory structure in multi-file exports", () => {
      // Create project with nested rules
      const projectDir = join(TEST_DIR, "export-project");
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(join(projectDir, ".aligntrue/rules/backend"), {
        recursive: true,
      });
      mkdirSync(join(projectDir, ".aligntrue/rules/frontend"), {
        recursive: true,
      });

      // Create rule files
      writeFileSync(
        join(projectDir, ".aligntrue/rules/backend/security.md"),
        `---
title: Backend Security
---

# Backend Security

Security guidelines`,
      );

      writeFileSync(
        join(projectDir, ".aligntrue/rules/frontend/react.md"),
        `---
title: React Guidelines
---

# React Guidelines

React best practices`,
      );

      // Create config targeting Cursor (multi-file exporter)
      writeFileSync(
        join(projectDir, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - cursor
`,
        "utf-8",
      );

      // Run sync (use --no-detect to skip agent detection in test environment)
      execSync(`node "${CLI_PATH}" sync --yes --no-detect`, {
        cwd: projectDir,
        stdio: "pipe",
      });

      // Verify structure is preserved in .cursor/rules
      expect(
        existsSync(join(projectDir, ".cursor/rules/backend/security.mdc")),
      ).toBe(true);
      expect(
        existsSync(join(projectDir, ".cursor/rules/frontend/react.mdc")),
      ).toBe(true);

      // Verify content is correct
      const backendContent = readFileSync(
        join(projectDir, ".cursor/rules/backend/security.mdc"),
        "utf-8",
      );
      expect(backendContent).toContain("Backend Security");
    });

    it("should include full path in AGENTS.md links for nested rules", () => {
      // Create project with nested rules
      const projectDir = join(TEST_DIR, "agents-project");
      mkdirSync(projectDir, { recursive: true });
      mkdirSync(join(projectDir, ".aligntrue/rules/backend"), {
        recursive: true,
      });
      mkdirSync(join(projectDir, ".aligntrue/rules/frontend"), {
        recursive: true,
      });

      // Create rule files
      writeFileSync(
        join(projectDir, ".aligntrue/rules/backend/security.md"),
        `---
title: Backend Security
description: Backend security guidelines
---

# Backend Security

Guidelines here`,
      );

      // Add a second rule to trigger link-based format (auto mode uses links for 2+ rules)
      writeFileSync(
        join(projectDir, ".aligntrue/rules/frontend/performance.md"),
        `---
title: Frontend Performance
description: Frontend performance guidelines
---

# Frontend Performance

Performance guidelines here`,
      );

      // Create config targeting AGENTS.md (single-file exporter)
      writeFileSync(
        join(projectDir, ".aligntrue/config.yaml"),
        `version: "1"
mode: solo
sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - agents
`,
        "utf-8",
      );

      // Run sync (use --no-detect to skip agent detection in test environment)
      execSync(`node "${CLI_PATH}" sync --yes --no-detect`, {
        cwd: projectDir,
        stdio: "pipe",
      });

      // Verify AGENTS.md includes full path in link
      const agentsMd = readFileSync(join(projectDir, "AGENTS.md"), "utf-8");
      expect(agentsMd).toContain("./.aligntrue/rules/backend/security.md");
      expect(agentsMd).toContain("Backend Security");
    });
  });
});
