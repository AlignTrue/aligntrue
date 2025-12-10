import { describe, expect, it } from "vitest";

import { getSubmittedUrlFromSearch } from "./urlFromSearch";

describe("getSubmittedUrlFromSearch", () => {
  it("returns explicit url query param when present", () => {
    const url = getSubmittedUrlFromSearch("?url=https://github.com/org/repo");
    expect(url).toBe("https://github.com/org/repo");
  });

  it("supports marketing-style single query key that is a URL", () => {
    const url = getSubmittedUrlFromSearch("?https://github.com/org/repo");
    expect(url).toBe("https://github.com/org/repo");
  });

  it("returns null when no URL is provided", () => {
    expect(getSubmittedUrlFromSearch("?foo=bar")).toBeNull();
    expect(getSubmittedUrlFromSearch("")).toBeNull();
  });
});
