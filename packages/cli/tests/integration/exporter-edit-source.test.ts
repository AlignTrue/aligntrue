/**
 * Test edit_source behavior across all multi-file exporters
 * Verifies that unauthorized edits to non-edit_source files are overwritten
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createHermeticTestEnv, type TestEnv } from "../utils/test-env.js";

// Multi-file exporters and their file paths
const MULTI_FILE_EXPORTERS = [
  { name: "cursor", filePath: ".cursor/rules/aligntrue.mdc" },
  // Add additional multi-file exporters here as they support edit_source:
  // { name: "amazonq", filePath: ".amazonq/rules/aligntrue.md" },
  // { name: "augmentcode", filePath: ".augment/rules/aligntrue.md" },
  // etc.
];

describe.each(MULTI_FILE_EXPORTERS)(
  "Edit source behavior for $name exporter",
  ({ name, filePath }) => {
    let env: TestEnv;

    beforeEach(() => {
      env = createHermeticTestEnv();
    });

    afterEach(() => {
      env.cleanup();
    });

    it(`should overwrite unauthorized edits to ${name} files when edit_source is AGENTS.md`, async () => {
      // Initialize with both agents and target exporter
      const initResult = env.runCLI(`init --yes --exporters agents,${name}`);
      expect(initResult.exitCode).toBe(0);

      // Explicitly set edit_source to AGENTS.md (making other files read-only)
      const configPath = env.path(".aligntrue", "config.yaml");
      let config = readFileSync(configPath, "utf-8");

      if (!config.includes("edit_source:")) {
        config += "\nsync:\n  edit_source: AGENTS.md\n";
        writeFileSync(configPath, config, "utf-8");
      }

      // Run initial sync to create files
      const syncResult1 = env.runCLI("sync --force --non-interactive");
      expect(syncResult1.exitCode).toBe(0);

      // Verify the exporter file was created
      const exporterFile = env.path(filePath);
      expect(existsSync(exporterFile)).toBe(true);

      // Make an unauthorized edit to the read-only file
      const originalContent = readFileSync(exporterFile, "utf-8");
      const modifiedContent =
        originalContent +
        "\n## Unauthorized Edit\n\nThis should be overwritten.";
      writeFileSync(exporterFile, modifiedContent, "utf-8");

      // Verify the edit is present before sync
      expect(readFileSync(exporterFile, "utf-8")).toContain(
        "Unauthorized Edit",
      );

      // Run sync again - should overwrite the unauthorized edit
      const syncResult2 = env.runCLI("sync --force --non-interactive");
      expect(syncResult2.exitCode).toBe(0);

      // Verify the unauthorized edit was removed (overwritten by IR export)
      const finalContent = readFileSync(exporterFile, "utf-8");
      expect(finalContent).not.toContain("Unauthorized Edit");
    });

    it(`should preserve edits to ${name} files when edit_source matches the exporter pattern`, async () => {
      // Initialize with target exporter
      const initResult = env.runCLI(`init --yes --exporters ${name}`);
      expect(initResult.exitCode).toBe(0);

      // Set edit_source to match the exporter's file pattern
      const configPath = env.path(".aligntrue", "config.yaml");
      let config = readFileSync(configPath, "utf-8");

      // Derive the edit_source pattern from the file path
      // e.g., ".cursor/rules/aligntrue.mdc" -> ".cursor/rules/*.mdc"
      const pattern = filePath.replace(/[^\/]+\.(mdc?|json|md)$/, "*.mdc");

      if (!config.includes("edit_source:")) {
        config += `\nsync:\n  edit_source: ${pattern}\n`;
        writeFileSync(configPath, config, "utf-8");
      }

      // Run initial sync
      const syncResult1 = env.runCLI("sync --force --non-interactive");
      expect(syncResult1.exitCode).toBe(0);

      // Make an authorized edit (file is in edit_source)
      const exporterFile = env.path(filePath);
      const originalContent = readFileSync(exporterFile, "utf-8");
      const modifiedContent =
        originalContent + "\n## Authorized Edit\n\nThis should be preserved.";
      writeFileSync(exporterFile, modifiedContent, "utf-8");

      // Run sync - should preserve the edit and merge it to IR
      const syncResult2 = env.runCLI("sync --force --non-interactive");
      expect(syncResult2.exitCode).toBe(0);

      // Verify the edit is still present in the file
      const finalContent = readFileSync(exporterFile, "utf-8");
      expect(finalContent).toContain("Authorized Edit");

      // Verify the edit was synced to IR
      const irPath = env.path(".aligntrue", ".rules.yaml");
      const irContent = readFileSync(irPath, "utf-8");
      expect(irContent).toContain("Authorized Edit");
    });
  },
);
