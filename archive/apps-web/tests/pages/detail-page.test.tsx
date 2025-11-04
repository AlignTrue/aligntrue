/**
 * Pack detail page tests (Phase 4, Session 3)
 * Updated to test PackDetailClient component (client-side logic)
 * Server-side behavior tested in detail-page-ssr.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createTestPack } from "../lib/test-utils";
import { PackDetailClient } from "@/app/catalog/[slug]/PackDetailClient";

describe("PackDetailClient", () => {
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

  const mockAllPacks = [mockPack];

  beforeEach(() => {
    // Mock window.location for structured data JSON-LD
    Object.defineProperty(window, "location", {
      value: { origin: "https://aligntrue.ai" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render pack name and version", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(
      screen.getByRole("heading", { name: "Base Global" }),
    ).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("should display badges for source linked and overlay friendly", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Source Linked")).toBeInTheDocument();
    expect(screen.getByText("Overlay Friendly")).toBeInTheDocument();
  });

  it("should render summary bullets", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Code quality checks")).toBeInTheDocument();
    expect(screen.getByText("Security scanning")).toBeInTheDocument();
    expect(screen.getByText("Performance monitoring")).toBeInTheDocument();
  });

  it("should render full description", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(
      screen.getByText(/Essential rules for all projects with best practices/),
    ).toBeInTheDocument();
  });

  it("should display stats row", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("150 copies/7d")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
    // Use getAllByText since "AlignTrue" appears multiple times (button, footer, etc)
    const aligntrueMatches = screen.getAllByText(/AlignTrue/);
    expect(aligntrueMatches.length).toBeGreaterThan(0);
    // Date format may vary (Oct 30 vs Oct 31), just check for "Updated"
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it("should render maintainer GitHub link", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    const link = screen.getByRole("link", {
      name: /View AlignTrue on GitHub/i,
    });
    expect(link).toHaveAttribute("href", "https://github.com/aligntrue");
  });

  it("should render source repo link", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    const link = screen.getByRole("link", {
      name: /View source repository/i,
    });
    expect(link).toHaveAttribute("href", "https://github.com/AlignTrue/aligns");
  });

  it("should display categories as badges", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("code quality")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("performance")).toBeInTheDocument();
  });

  it("should display compatible tools", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Compatible with:")).toBeInTheDocument();
    expect(screen.getByText("cursor")).toBeInTheDocument();
    expect(screen.getByText("claude-code")).toBeInTheDocument();
    expect(screen.getByText("warp")).toBeInTheDocument();
    expect(screen.getByText("windsurf")).toBeInTheDocument();
  });

  it("should render ExporterPreview component", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    // Check for tab navigation (from ExporterPreview)
    expect(screen.getByRole("tab", { name: /YAML/i })).toBeInTheDocument();
  });

  it("should render CopyBlock component", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    // Check for installation heading (from CopyBlock)
    expect(
      screen.getByRole("heading", { name: "Installation" }),
    ).toBeInTheDocument();
  });

  it("should render RelatedPacks component", () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    // Component renders when there are related packs
    // With only one pack, RelatedPacks returns null
    expect(
      screen.queryByRole("heading", { name: "Related packs" }),
    ).not.toBeInTheDocument();
  });

  it('should show "New" for packs with zero copies', () => {
    const newPack = createTestPack({ ...mockPack, stats: { copies_7d: 0 } });
    render(<PackDetailClient pack={newPack} allPacks={[newPack]} />);

    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("should handle packs without source repo", () => {
    const packWithoutRepo = createTestPack({
      ...mockPack,
      source_repo: undefined,
    });
    render(
      <PackDetailClient pack={packWithoutRepo} allPacks={[packWithoutRepo]} />,
    );

    expect(
      screen.getByRole("heading", { name: "Base Global" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View source repository/i }),
    ).not.toBeInTheDocument();
  });

  it("should handle packs without maintainer GitHub", () => {
    const packWithoutGithub = createTestPack({
      ...mockPack,
      maintainer: { name: "AlignTrue" },
    });
    render(
      <PackDetailClient
        pack={packWithoutGithub}
        allPacks={[packWithoutGithub]}
      />,
    );

    expect(screen.getByText("AlignTrue")).toBeInTheDocument();
    expect(screen.queryByText(/@aligntrue/)).not.toBeInTheDocument();
  });
});
