/**
 * Tests for selective import UI utility
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as clack from "@clack/prompts";
import {
  selectFilesToImport,
  type ImportFile,
} from "../../src/utils/selective-import-ui.js";

vi.mock("@clack/prompts");

describe("selectFilesToImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tier 1: single file", () => {
    it("should auto-import single file without prompts", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/.cursor/rules/testing.mdc",
          relativePath: ".cursor/rules/testing.mdc",
        },
      ];

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.selectedFileCount).toBe(1);
      expect(result.totalFileCount).toBe(1);
      expect(result.skipped).toBe(false);
      expect(result.selectedFiles).toEqual(files);
      expect(clack.confirm).not.toHaveBeenCalled();
    });

    it("should log success message for single file", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/AGENTS.md",
          relativePath: "AGENTS.md",
        },
      ];

      vi.mocked(clack.log).success = vi.fn();

      await selectFilesToImport(files, { nonInteractive: false });

      expect(clack.log.success).toHaveBeenCalledWith(
        expect.stringContaining("Importing 1 rule"),
      );
    });
  });

  describe("tier 2: small flat folder", () => {
    it("should show list and confirm for 2-10 files in single folder", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/.cursor/rules/testing.mdc",
          relativePath: ".cursor/rules/testing.mdc",
        },
        {
          path: "/project/.cursor/rules/debugging.mdc",
          relativePath: ".cursor/rules/debugging.mdc",
        },
        {
          path: "/project/.cursor/rules/typescript.mdc",
          relativePath: ".cursor/rules/typescript.mdc",
        },
      ];

      vi.mocked(clack.confirm).mockResolvedValue(true);

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.selectedFileCount).toBe(3);
      expect(clack.confirm).toHaveBeenCalled();
    });

    it("should show multiselect when user selects no on small folder", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/.cursor/rules/testing.mdc",
          relativePath: ".cursor/rules/testing.mdc",
        },
        {
          path: "/project/.cursor/rules/debugging.mdc",
          relativePath: ".cursor/rules/debugging.mdc",
        },
      ];

      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.multiselect).mockResolvedValue([
        ".cursor/rules/testing.mdc",
      ]);

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.selectedFileCount).toBe(1);
      expect(clack.multiselect).toHaveBeenCalled();
    });

    it("should return empty and skipped=true when user cancels multiselect", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/.cursor/rules/testing.mdc",
          relativePath: ".cursor/rules/testing.mdc",
        },
      ];

      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.multiselect).mockReturnValue(Symbol.for("cancel") as any);

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.selectedFileCount).toBe(0);
      expect(result.skipped).toBe(true);
    });
  });

  describe("tier 3: large or multiple folders", () => {
    it("should show count summary for 11+ files in single folder", async () => {
      const files: ImportFile[] = Array.from({ length: 15 }, (_, i) => ({
        path: `/project/.cursor/rules/rule${i}.mdc`,
        relativePath: `.cursor/rules/rule${i}.mdc`,
      }));

      vi.mocked(clack.confirm).mockResolvedValue(true);

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.selectedFileCount).toBe(15);
      expect(clack.confirm).toHaveBeenCalled();
    });

    it("should show folder multiselect for multiple folders", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/.cursor/rules/testing.mdc",
          relativePath: ".cursor/rules/testing.mdc",
        },
        {
          path: "/project/AGENTS.md",
          relativePath: "AGENTS.md",
        },
        {
          path: "/project/packages/api/.cursor/rules/api.mdc",
          relativePath: "packages/api/.cursor/rules/api.mdc",
        },
      ];

      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.multiselect).mockResolvedValue([".cursor/rules"]);

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(clack.multiselect).toHaveBeenCalled();
      // Only files in .cursor/rules should be selected
      expect(result.selectedFileCount).toBeGreaterThan(0);
    });

    it("should return empty when user selects no folders", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/.cursor/rules/testing.mdc",
          relativePath: ".cursor/rules/testing.mdc",
        },
        {
          path: "/project/AGENTS.md",
          relativePath: "AGENTS.md",
        },
      ];

      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.multiselect).mockResolvedValue([]);

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.selectedFileCount).toBe(0);
      expect(result.skipped).toBe(false);
    });
  });

  describe("non-interactive mode", () => {
    it("should auto-import all files in non-interactive mode", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/.cursor/rules/testing.mdc",
          relativePath: ".cursor/rules/testing.mdc",
        },
        {
          path: "/project/.cursor/rules/debugging.mdc",
          relativePath: ".cursor/rules/debugging.mdc",
        },
      ];

      const result = await selectFilesToImport(files, {
        nonInteractive: true,
      });

      expect(result.selectedFileCount).toBe(2);
      expect(result.skipped).toBe(false);
      expect(clack.confirm).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle empty file list", async () => {
      const result = await selectFilesToImport([], { nonInteractive: false });

      expect(result.selectedFileCount).toBe(0);
      expect(result.totalFileCount).toBe(0);
    });

    it("should handle files with no folder (root level)", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/AGENTS.md",
          relativePath: "AGENTS.md",
        },
      ];

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.selectedFileCount).toBe(1);
      expect(result.selectedFiles[0]!.relativePath).toBe("AGENTS.md");
    });

    it("should handle deeply nested file paths", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/packages/api/services/.cursor/rules/api.mdc",
          relativePath: "packages/api/services/.cursor/rules/api.mdc",
        },
        {
          path: "/project/packages/api/services/.cursor/rules/db.mdc",
          relativePath: "packages/api/services/.cursor/rules/db.mdc",
        },
      ];

      vi.mocked(clack.confirm).mockResolvedValue(true);

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.selectedFileCount).toBe(2);
    });
  });

  describe("cancel handling", () => {
    it("should handle user cancelling confirm prompt", async () => {
      const files: ImportFile[] = [
        {
          path: "/project/.cursor/rules/testing.mdc",
          relativePath: ".cursor/rules/testing.mdc",
        },
        {
          path: "/project/.cursor/rules/debugging.mdc",
          relativePath: ".cursor/rules/debugging.mdc",
        },
      ];

      vi.mocked(clack.confirm).mockReturnValue(Symbol.for("cancel") as any);

      const result = await selectFilesToImport(files, {
        nonInteractive: false,
      });

      expect(result.skipped).toBe(true);
    });
  });
});
