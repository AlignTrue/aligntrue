/**
 * Tests for section fingerprint generation
 */

import { describe, it, expect } from "vitest";
import {
  generateFingerprint,
  normalizeContent,
  extractExplicitId,
  isValidFingerprint,
  isSameSection,
} from "../../src/tracking/section-fingerprint.js";

describe("generateFingerprint", () => {
  it("generates stable fingerprint from heading and content", () => {
    const fp = generateFingerprint(
      "Testing Instructions",
      "Run tests before commit",
    );
    expect(fp).toMatch(/^testing-instructions-[a-f0-9]{6}$/);
  });

  it("generates same fingerprint for same content", () => {
    const fp1 = generateFingerprint("Testing", "Content here");
    const fp2 = generateFingerprint("Testing", "Content here");
    expect(fp1).toBe(fp2);
  });

  it("generates different fingerprint for different content", () => {
    const fp1 = generateFingerprint("Testing", "Content A");
    const fp2 = generateFingerprint("Testing", "Content B");
    expect(fp1).not.toBe(fp2);
  });

  it("normalizes heading to kebab-case", () => {
    const fp = generateFingerprint("Testing & Security Rules", "content");
    expect(fp).toMatch(/^testing-security-rules-[a-f0-9]{6}$/);
  });

  it("handles special characters in heading", () => {
    const fp = generateFingerprint("API: REST vs. GraphQL", "content");
    expect(fp).toMatch(/^api-rest-vs-graphql-[a-f0-9]{6}$/);
  });

  it("limits heading length", () => {
    const longHeading = "A".repeat(100);
    const fp = generateFingerprint(longHeading, "content");
    const headingPart = fp.substring(0, fp.lastIndexOf("-"));
    expect(headingPart.length).toBeLessThanOrEqual(50);
  });

  it("is stable across whitespace changes", () => {
    const fp1 = generateFingerprint("Testing", "Run tests\nbefore commit");
    const fp2 = generateFingerprint("Testing", "Run tests  before commit");
    expect(fp1).toBe(fp2);
  });
});

describe("normalizeContent", () => {
  it("normalizes all whitespace to single spaces", () => {
    const normalized = normalizeContent("line1\r\nline2\rline3\nline4");
    expect(normalized).toBe("line1 line2 line3 line4");
  });

  it("trims leading and trailing whitespace", () => {
    const normalized = normalizeContent("  content  \n  ");
    expect(normalized).toBe("content");
  });

  it("collapses multiple spaces", () => {
    const normalized = normalizeContent("  Text with   spaces  ");
    expect(normalized).toBe("Text with spaces");
  });

  it("normalizes complex whitespace combinations", () => {
    const content = "Text\n    code block\n    more code\nText";
    const normalized = normalizeContent(content);
    // All whitespace becomes single spaces for stable hashing
    expect(normalized).toBe("Text code block more code Text");
  });
});

describe("extractExplicitId", () => {
  it("extracts explicit ID from HTML comment", () => {
    const id = extractExplicitId("<!-- aligntrue-id: custom-id -->");
    expect(id).toBe("custom-id");
  });

  it("handles extra whitespace in comment", () => {
    const id = extractExplicitId("<!--  aligntrue-id:  custom-id  -->");
    expect(id).toBe("custom-id");
  });

  it("returns undefined when no explicit ID", () => {
    const id = extractExplicitId("Regular content without ID");
    expect(id).toBeUndefined();
  });

  it("only accepts valid ID format", () => {
    const id = extractExplicitId("<!-- aligntrue-id: Invalid ID! -->");
    expect(id).toBeUndefined();
  });
});

describe("isValidFingerprint", () => {
  it("validates correct fingerprint format", () => {
    expect(isValidFingerprint("testing-abc123")).toBe(true);
    expect(isValidFingerprint("api-rest-vs-graphql-def456")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidFingerprint("TestingABC123")).toBe(false); // uppercase
    expect(isValidFingerprint("testing_abc123")).toBe(false); // underscore
    expect(isValidFingerprint("testing-abc12")).toBe(false); // too short hash
    expect(isValidFingerprint("testing-abc1234")).toBe(false); // too long hash
    expect(isValidFingerprint("-testing-abc123")).toBe(false); // leading dash
    expect(isValidFingerprint("testing-abc123-")).toBe(false); // trailing dash
  });
});

describe("isSameSection", () => {
  it("returns true for exact match", () => {
    expect(isSameSection("testing-abc123", "testing-abc123")).toBe(true);
  });

  it("returns true for same heading, different content", () => {
    expect(isSameSection("testing-abc123", "testing-def456")).toBe(true);
  });

  it("returns false for different headings", () => {
    expect(isSameSection("testing-abc123", "security-abc123")).toBe(false);
  });
});
