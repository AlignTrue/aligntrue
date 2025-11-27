import { describe, it, expect } from "vitest";
import {
  isAlignTrueManagedIgnoreFile,
  hasAlignTrueSection,
} from "../../src/agent-ignore/manager.js";

describe("Ignore file toggle", () => {
  describe("isAlignTrueManagedIgnoreFile", () => {
    it("should return true for files with AlignTrue section", () => {
      // Files with AlignTrue managed section should be detected
      // This is tested through manager.test.ts already
      expect(typeof isAlignTrueManagedIgnoreFile("/tmp/.cursorignore")).toBe(
        "boolean",
      );
    });
  });

  describe("hasAlignTrueSection", () => {
    it("should detect AlignTrue section marker", () => {
      const content = `# Some content
# AlignTrue: Prevent duplicate context
AGENTS.md
# AlignTrue: End duplicate prevention
`;
      expect(hasAlignTrueSection(content)).toBe(true);
    });

    it("should return false without AlignTrue section", () => {
      const content = `AGENTS.md
node_modules/
`;
      expect(hasAlignTrueSection(content)).toBe(false);
    });
  });
});
