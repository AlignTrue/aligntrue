/**
 * Tests for PackCard component with source badge enhancement (Phase 4, Session 5)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import { PackCard } from "../../components/catalog/PackCard";

/**
 * Create minimal pack for testing
 */
function createTestPack(
  overrides: Partial<CatalogEntryExtended> = {},
): CatalogEntryExtended {
  return {
    id: "packs/base/test-pack",
    version: "1.0.0",
    name: "Test Pack",
    slug: "test-pack",
    description: "A test pack for unit tests",
    summary_bullets: ["Feature 1", "Feature 2"],
    categories: ["testing", "development"],
    compatible_tools: ["cursor", "claude-code"],
    license: "CC0-1.0",
    maintainer: {
      name: "Test Author",
      github: "testauthor",
    },
    last_updated: "2025-10-31T00:00:00Z",
    stats: {
      copies_7d: 42,
    },
    has_plugs: false,
    overlay_friendly: false,
    required_plugs_count: 0,
    exporters: [],
    ...overrides,
  };
}

describe("PackCard - Source Badge", () => {
  it("displays source badge when source_repo exists", () => {
    const pack = createTestPack({
      source_repo: "https://github.com/test/repo",
    });

    render(<PackCard pack={pack} />);

    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByLabelText("View source repository")).toBeInTheDocument();
  });

  it("does not display source badge when source_repo is missing", () => {
    const pack = createTestPack({
      source_repo: undefined,
    });

    render(<PackCard pack={pack} />);

    expect(screen.queryByText("Source")).not.toBeInTheDocument();
  });

  it("source badge links to source_repo URL", () => {
    const sourceUrl = "https://github.com/test/repo";
    const pack = createTestPack({
      source_repo: sourceUrl,
    });

    render(<PackCard pack={pack} />);

    const link = screen.getByLabelText("View source repository");
    expect(link).toHaveAttribute("href", sourceUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("source badge has tooltip", () => {
    const pack = createTestPack({
      source_repo: "https://github.com/test/repo",
    });

    render(<PackCard pack={pack} />);

    const link = screen.getByLabelText("View source repository");
    expect(link).toHaveAttribute("title", "Source code available for review");
  });

  it("source badge displays external link icon", () => {
    const pack = createTestPack({
      source_repo: "https://github.com/test/repo",
    });

    render(<PackCard pack={pack} />);

    const link = screen.getByLabelText("View source repository");
    const icon = link.querySelector("svg");

    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("source badge stops propagation when clicked", () => {
    const pack = createTestPack({
      source_repo: "https://github.com/test/repo",
    });
    const onClick = vi.fn();

    render(<PackCard pack={pack} onClick={onClick} />);

    const sourceLink = screen.getByLabelText("View source repository");
    fireEvent.click(sourceLink);

    // Card onClick should not be called
    expect(onClick).not.toHaveBeenCalled();
  });

  it("displays source badge alongside other badges", () => {
    const pack = createTestPack({
      source_repo: "https://github.com/test/repo",
      source_linked: true,
      overlay_friendly: true,
    });

    render(<PackCard pack={pack} />);

    expect(screen.getByText("Source Linked")).toBeInTheDocument();
    expect(screen.getByText("Overlay Friendly")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
  });
});

describe("PackCard - Existing Functionality", () => {
  it("renders pack name and version", () => {
    const pack = createTestPack();

    render(<PackCard pack={pack} />);

    expect(screen.getByText("Test Pack")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("renders description", () => {
    const pack = createTestPack();

    render(<PackCard pack={pack} />);

    expect(screen.getByText("A test pack for unit tests")).toBeInTheDocument();
  });

  it("renders categories", () => {
    const pack = createTestPack();

    render(<PackCard pack={pack} />);

    expect(screen.getByText("testing")).toBeInTheDocument();
    expect(screen.getByText("development")).toBeInTheDocument();
  });

  it("renders stats", () => {
    const pack = createTestPack();

    render(<PackCard pack={pack} />);

    expect(screen.getByText("42 copies/7d")).toBeInTheDocument();
    expect(screen.getByText("CC0-1.0")).toBeInTheDocument();
  });

  it("calls onClick when card clicked", () => {
    const pack = createTestPack();
    const onClick = vi.fn();

    render(<PackCard pack={pack} onClick={onClick} />);

    const card = screen.getByRole("button");
    fireEvent.click(card);

    expect(onClick).toHaveBeenCalledWith(pack);
  });

  it("handles Enter key press", () => {
    const pack = createTestPack();
    const onClick = vi.fn();

    render(<PackCard pack={pack} onClick={onClick} />);

    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onClick).toHaveBeenCalledWith(pack);
  });

  it("handles Space key press", () => {
    const pack = createTestPack();
    const onClick = vi.fn();

    render(<PackCard pack={pack} onClick={onClick} />);

    const card = screen.getByRole("button");
    fireEvent.keyDown(card, { key: " " });

    expect(onClick).toHaveBeenCalledWith(pack);
  });

  it("renders as article when no onClick provided", () => {
    const pack = createTestPack();

    render(<PackCard pack={pack} />);

    const card = screen.getByRole("article");
    expect(card).toBeInTheDocument();
  });

  it("renders maintainer with GitHub link", () => {
    const pack = createTestPack();

    render(<PackCard pack={pack} />);

    expect(screen.getByText("Test Author")).toBeInTheDocument();

    const githubLink = screen.getByLabelText("View Test Author on GitHub");
    expect(githubLink).toHaveAttribute("href", "https://github.com/testauthor");
  });
});
