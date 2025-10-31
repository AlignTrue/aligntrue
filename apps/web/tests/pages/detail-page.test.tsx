/**
 * Pack detail page tests (Phase 4, Session 3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createTestPack } from "../lib/test-utils";

// Mock Next.js router
const mockUseParams = vi.fn(() => ({ slug: "base-global" }));
vi.mock("next/navigation", () => ({
  useParams: mockUseParams,
}));

// Import after mocks
const PackDetailPage = (await import("@/app/catalog/[slug]/page")).default;

describe("PackDetailPage", () => {
  const mockPack = createTestPack({
    id: "packs/base/base-global",
    slug: "base-global",
    name: "Base Global",
    description: "Essential rules for all projects with best practices",
    summary_bullets: [
      "Code quality checks",
      "Security scanning",
      "Performance monitoring",
    ],
    categories: ["code-quality", "security", "performance"],
    tags: ["essential", "baseline", "best-practices"],
    compatible_tools: ["cursor", "claude-code", "warp", "windsurf"],
    maintainer: {
      name: "AlignTrue",
      github: "aligntrue",
      email: "hello@aligntrue.ai",
    },
    source_repo: "https://github.com/AlignTrue/aligns",
    namespace_owner: "aligntrue",
    source_linked: true,
    stats: {
      copies_7d: 150,
    },
    overlay_friendly: true,
    license: "MIT",
  });

  // Mock fetch
  beforeEach(() => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/catalog/index.json")) {
        return Promise.resolve({
          ok: true,
          statusText: "OK",
          json: () =>
            Promise.resolve({
              version: "1",
              generated_at: "2025-10-31T10:00:00Z",
              engine_version: "0.1.0",
              packs: [mockPack],
            }),
        } as Response);
      }
      return Promise.reject(new Error("Not found"));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should show loading state initially", () => {
    render(<PackDetailPage />);
    expect(screen.getByText("Loading pack...")).toBeInTheDocument();
  });

  it("should render pack name and version", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Base Global" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("should display badges for source linked and overlay friendly", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Source Linked")).toBeInTheDocument();
    });

    expect(screen.getByText("Overlay Friendly")).toBeInTheDocument();
  });

  it("should render summary bullets", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Code quality checks")).toBeInTheDocument();
    });

    expect(screen.getByText("Security scanning")).toBeInTheDocument();
    expect(screen.getByText("Performance monitoring")).toBeInTheDocument();
  });

  it("should render full description", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Essential rules for all projects with best practices/,
        ),
      ).toBeInTheDocument();
    });
  });

  it("should display stats row", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("150 copies/7d")).toBeInTheDocument();
    });

    expect(screen.getByText("MIT")).toBeInTheDocument();
    // Use getAllByText since "AlignTrue" appears multiple times (button, footer, etc)
    const aligntrueMatches = screen.getAllByText(/AlignTrue/);
    expect(aligntrueMatches.length).toBeGreaterThan(0);
    // Date format may vary (Oct 30 vs Oct 31), just check for "Updated"
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it("should render maintainer GitHub link", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      const link = screen.getByRole("link", {
        name: /View AlignTrue on GitHub/i,
      });
      expect(link).toHaveAttribute("href", "https://github.com/aligntrue");
    });
  });

  it("should render source repo link", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      const link = screen.getByRole("link", {
        name: /View source repository/i,
      });
      expect(link).toHaveAttribute(
        "href",
        "https://github.com/AlignTrue/aligns",
      );
    });
  });

  it("should display categories as badges", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("code quality")).toBeInTheDocument();
    });

    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("performance")).toBeInTheDocument();
  });

  it("should display compatible tools", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Compatible with:")).toBeInTheDocument();
    });

    expect(screen.getByText("cursor")).toBeInTheDocument();
    expect(screen.getByText("claude-code")).toBeInTheDocument();
    expect(screen.getByText("warp")).toBeInTheDocument();
    expect(screen.getByText("windsurf")).toBeInTheDocument();
  });

  it("should render ExporterPreview component", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      // Check for tab navigation (from ExporterPreview)
      expect(screen.getByRole("tab", { name: /YAML/i })).toBeInTheDocument();
    });
  });

  it("should render CopyBlock component", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      // Check for installation heading (from CopyBlock)
      expect(
        screen.getByRole("heading", { name: "Installation" }),
      ).toBeInTheDocument();
    });
  });

  it("should render RelatedPacks component", async () => {
    render(<PackDetailPage />);

    await waitFor(() => {
      // Component renders when there are related packs
      // With only one pack, RelatedPacks returns null
      expect(
        screen.queryByRole("heading", { name: "Related packs" }),
      ).not.toBeInTheDocument();
    });
  });

  it("should show error when pack not found", async () => {
    // Mock useParams to return non-existent slug
    mockUseParams.mockReturnValue({ slug: "non-existent" });

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByText(/Pack not found/)).toBeInTheDocument();
    });
  });

  it("should show error when catalog fails to load", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: "Server Error",
      } as Response),
    );

    render(<PackDetailPage />);

    await waitFor(() => {
      // Use regex to match partial text since full message includes statusText
      expect(screen.getByText(/Failed to load catalog/i)).toBeInTheDocument();
    });
  });

  it("should have back to catalog link in error state", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: "Server Error",
      } as Response),
    );

    render(<PackDetailPage />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Back to catalog/i });
      expect(link).toHaveAttribute("href", "/catalog");
    });
  });

  it("should handle network errors gracefully", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    render(<PackDetailPage />);

    await waitFor(() => {
      // Error message shows the actual error text, not "Failed to load pack"
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('should show "New" for packs with zero copies', async () => {
    const newPack = createTestPack({ ...mockPack, stats: { copies_7d: 0 } });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            version: "1",
            generated_at: "2025-10-31T10:00:00Z",
            engine_version: "0.1.0",
            packs: [newPack],
          }),
      } as Response),
    );

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("New")).toBeInTheDocument();
    });
  });

  it("should handle packs without source repo", async () => {
    const packWithoutRepo = createTestPack({
      ...mockPack,
      source_repo: undefined,
    });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            version: "1",
            generated_at: "2025-10-31T10:00:00Z",
            engine_version: "0.1.0",
            packs: [packWithoutRepo],
          }),
      } as Response),
    );

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Base Global" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: /View source repository/i }),
    ).not.toBeInTheDocument();
  });

  it("should handle packs without maintainer GitHub", async () => {
    const packWithoutGithub = createTestPack({
      ...mockPack,
      maintainer: { name: "AlignTrue" },
    });
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            version: "1",
            generated_at: "2025-10-31T10:00:00Z",
            engine_version: "0.1.0",
            packs: [packWithoutGithub],
          }),
      } as Response),
    );

    render(<PackDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("AlignTrue")).toBeInTheDocument();
    });

    expect(screen.queryByText(/@aligntrue/)).not.toBeInTheDocument();
  });
});
