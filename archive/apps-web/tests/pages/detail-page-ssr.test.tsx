/**
 * Tests for pack detail page server-side rendering and 404 handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notFound } from "next/navigation";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

describe("Pack detail page SSR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call notFound() for non-existent pack", async () => {
    // Mock fetch to return catalog without the pack
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ packs: [] }),
    });

    // Dynamically import the page component after mocks are set up
    const { default: PackDetailPage } = await import(
      "@/app/catalog/[slug]/page"
    );

    // Expect notFound() to be called which throws NEXT_NOT_FOUND
    await expect(
      PackDetailPage({ params: Promise.resolve({ slug: "nonexistent" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("should call notFound() when fetch fails", async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Server Error",
    });

    // Dynamically import the page component after mocks are set up
    const { default: PackDetailPage } = await import(
      "@/app/catalog/[slug]/page"
    );

    // Expect notFound() to be called when fetch fails
    await expect(
      PackDetailPage({ params: Promise.resolve({ slug: "base-global" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("should render successfully when pack exists", async () => {
    const mockPack = {
      id: "packs/base/base-global",
      slug: "base-global",
      name: "Base Global",
      version: "1.0.0",
      description: "Test pack",
      published_at: "2025-10-01",
      last_updated: "2025-10-31",
      license: "CC0-1.0",
      categories: ["test"],
      compatible_tools: ["cursor"],
      maintainer: {
        name: "Test",
        github: "test",
      },
      source_repo: "https://github.com/test/test",
      stats: {
        copies_7d: 10,
      },
      summary_bullets: [],
      has_plugs: false,
      required_plugs_count: 0,
      required_plugs: [],
      overlay_friendly: false,
      source_linked: true,
      rules_index: [],
      exporters: [],
    };

    // Mock fetch to return catalog with the pack
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ packs: [mockPack] }),
    });

    // Dynamically import the page component after mocks are set up
    const { default: PackDetailPage } = await import(
      "@/app/catalog/[slug]/page"
    );

    // Should not throw and should not call notFound
    const result = await PackDetailPage({
      params: Promise.resolve({ slug: "base-global" }),
    });

    expect(notFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
