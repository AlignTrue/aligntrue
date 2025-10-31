import { describe, it, expect } from "vitest";
import {
  validateSourceRepoUrl,
  shouldShowSourceLinkedBadge,
  SUPPORTED_PLATFORMS,
} from "./validate-source-repo.js";

describe("Source Repo Validation", () => {
  describe("validateSourceRepoUrl", () => {
    it("validates GitHub URL", () => {
      const result = validateSourceRepoUrl(
        "https://github.com/AlignTrue/aligns",
      );
      expect(result.valid).toBe(true);
      expect(result.platform).toBe("github");
      expect(result.error).toBeUndefined();
    });

    it("validates GitHub URL with trailing slash", () => {
      const result = validateSourceRepoUrl(
        "https://github.com/AlignTrue/aligns/",
      );
      expect(result.valid).toBe(true);
      expect(result.platform).toBe("github");
    });

    it("validates GitHub URL with hyphens", () => {
      const result = validateSourceRepoUrl(
        "https://github.com/org-name/repo-name",
      );
      expect(result.valid).toBe(true);
      expect(result.platform).toBe("github");
    });

    it("validates GitHub URL with underscores", () => {
      const result = validateSourceRepoUrl(
        "https://github.com/org_name/repo_name",
      );
      expect(result.valid).toBe(true);
      expect(result.platform).toBe("github");
    });

    it("validates GitHub URL with dots", () => {
      const result = validateSourceRepoUrl(
        "https://github.com/org.name/repo.name",
      );
      expect(result.valid).toBe(true);
      expect(result.platform).toBe("github");
    });

    it("validates GitLab URL", () => {
      const result = validateSourceRepoUrl(
        "https://gitlab.com/orgname/reponame",
      );
      expect(result.valid).toBe(true);
      expect(result.platform).toBe("gitlab");
    });

    it("validates GitLab URL with trailing slash", () => {
      const result = validateSourceRepoUrl(
        "https://gitlab.com/orgname/reponame/",
      );
      expect(result.valid).toBe(true);
      expect(result.platform).toBe("gitlab");
    });

    it("rejects empty URL", () => {
      const result = validateSourceRepoUrl("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Source repo URL is empty");
    });

    it("rejects non-HTTPS URL", () => {
      const result = validateSourceRepoUrl("http://github.com/org/repo");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must use HTTPS");
    });

    it("rejects git protocol URL", () => {
      const result = validateSourceRepoUrl("git@github.com:org/repo.git");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("must use HTTPS");
    });

    it("rejects GitHub URL with path", () => {
      const result = validateSourceRepoUrl(
        "https://github.com/org/repo/issues",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid GitHub or GitLab");
    });

    it("rejects GitHub URL without repo", () => {
      const result = validateSourceRepoUrl("https://github.com/org");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid GitHub or GitLab");
    });

    it("rejects GitHub URL without org", () => {
      const result = validateSourceRepoUrl("https://github.com/");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid GitHub or GitLab");
    });

    it("rejects Bitbucket URL (unsupported platform)", () => {
      const result = validateSourceRepoUrl("https://bitbucket.org/org/repo");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid GitHub or GitLab");
    });

    it("rejects self-hosted GitLab URL", () => {
      const result = validateSourceRepoUrl(
        "https://gitlab.example.com/org/repo",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid GitHub or GitLab");
    });

    it("rejects arbitrary URL", () => {
      const result = validateSourceRepoUrl("https://example.com");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("valid GitHub or GitLab");
    });

    it("includes actual URL in error message", () => {
      const badUrl = "https://example.com/repo";
      const result = validateSourceRepoUrl(badUrl);
      expect(result.error).toContain(badUrl);
    });
  });

  describe("shouldShowSourceLinkedBadge", () => {
    it("returns true for valid GitHub URL", () => {
      expect(shouldShowSourceLinkedBadge("https://github.com/org/repo")).toBe(
        true,
      );
    });

    it("returns true for valid GitLab URL", () => {
      expect(shouldShowSourceLinkedBadge("https://gitlab.com/org/repo")).toBe(
        true,
      );
    });

    it("returns false for undefined URL", () => {
      expect(shouldShowSourceLinkedBadge(undefined)).toBe(false);
    });

    it("returns false for invalid URL", () => {
      expect(shouldShowSourceLinkedBadge("http://github.com/org/repo")).toBe(
        false,
      );
    });

    it("returns false for empty string", () => {
      expect(shouldShowSourceLinkedBadge("")).toBe(false);
    });

    it("returns false for unsupported platform", () => {
      expect(
        shouldShowSourceLinkedBadge("https://bitbucket.org/org/repo"),
      ).toBe(false);
    });
  });

  describe("SUPPORTED_PLATFORMS", () => {
    it("exports github pattern", () => {
      expect(SUPPORTED_PLATFORMS.github).toBeDefined();
      expect(SUPPORTED_PLATFORMS.github).toBeInstanceOf(RegExp);
    });

    it("exports gitlab pattern", () => {
      expect(SUPPORTED_PLATFORMS.gitlab).toBeDefined();
      expect(SUPPORTED_PLATFORMS.gitlab).toBeInstanceOf(RegExp);
    });

    it("github pattern matches valid URLs", () => {
      expect(
        SUPPORTED_PLATFORMS.github.test("https://github.com/org/repo"),
      ).toBe(true);
      expect(
        SUPPORTED_PLATFORMS.github.test("https://github.com/org/repo/"),
      ).toBe(true);
      expect(
        SUPPORTED_PLATFORMS.github.test(
          "https://github.com/org-name/repo-name",
        ),
      ).toBe(true);
    });

    it("github pattern rejects invalid URLs", () => {
      expect(
        SUPPORTED_PLATFORMS.github.test("http://github.com/org/repo"),
      ).toBe(false);
      expect(
        SUPPORTED_PLATFORMS.github.test("https://github.com/org/repo/issues"),
      ).toBe(false);
      expect(SUPPORTED_PLATFORMS.github.test("https://github.com/org")).toBe(
        false,
      );
    });

    it("gitlab pattern matches valid URLs", () => {
      expect(
        SUPPORTED_PLATFORMS.gitlab.test("https://gitlab.com/org/repo"),
      ).toBe(true);
      expect(
        SUPPORTED_PLATFORMS.gitlab.test("https://gitlab.com/org/repo/"),
      ).toBe(true);
    });

    it("gitlab pattern rejects invalid URLs", () => {
      expect(
        SUPPORTED_PLATFORMS.gitlab.test("https://gitlab.example.com/org/repo"),
      ).toBe(false);
      expect(
        SUPPORTED_PLATFORMS.gitlab.test("http://gitlab.com/org/repo"),
      ).toBe(false);
    });
  });
});
