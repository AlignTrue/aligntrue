import { describe, it, expect, beforeEach, vi } from "vitest";
import { existsSync } from "fs";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

import {
  isCatalogId,
  extractCatalogId,
} from "../../src/utils/catalog-resolver.js";

describe("catalog-resolver", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false);
  });

  describe("isCatalogId", () => {
    it("returns true for 11-char base64url ID", () => {
      expect(isCatalogId("abc123defgh")).toBe(true);
    });

    it("returns true for catalog URL", () => {
      expect(isCatalogId("https://aligntrue.ai/a/abc123defgh")).toBe(true);
    });

    it("returns false for near-miss lengths", () => {
      expect(isCatalogId("abc123defg")).toBe(false); // 10 chars
      expect(isCatalogId("abc123defghi")).toBe(false); // 12 chars
    });

    it("returns false if local file exists with that name", () => {
      const id = "abc123defgh";
      vi.mocked(existsSync).mockImplementation((p) => p === id);
      expect(isCatalogId(id)).toBe(false);
    });

    it("returns false for git URLs", () => {
      expect(isCatalogId("https://github.com/org/repo")).toBe(false);
    });

    it("returns false for local paths", () => {
      expect(isCatalogId("./local/path")).toBe(false);
      expect(isCatalogId("/absolute/path")).toBe(false);
    });
  });

  describe("extractCatalogId", () => {
    it("extracts ID from catalog URL", () => {
      expect(extractCatalogId("https://aligntrue.ai/a/abc123defgh")).toBe(
        "abc123defgh",
      );
    });

    it("returns bare ID as-is when no local collision", () => {
      expect(extractCatalogId("abc123defgh")).toBe("abc123defgh");
    });

    it("returns null for non-catalog inputs", () => {
      expect(extractCatalogId("https://github.com/org/repo")).toBeNull();
      expect(extractCatalogId("./local/path")).toBeNull();
    });

    it("returns null when local file exists with that name", () => {
      const id = "abc123defgh";
      vi.mocked(existsSync).mockImplementation((p) => p === id);
      expect(extractCatalogId(id)).toBeNull();
    });
  });
});
