/**
 * PackCard component tests (Phase 4, Session 2)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackCard } from "@/components/catalog/PackCard";
import type { CatalogEntryExtended } from "@aligntrue/schema";

describe("PackCard", () => {
  const mockPack: CatalogEntryExtended = {
    id: "packs/base/base-global",
    version: "1.0.0",
    name: "Base Global",
    slug: "base-global",
    description: "Essential rules for all projects",
    summary_bullets: ["Code quality", "Security", "Best practices"],
    categories: ["code-quality", "security"],
    tags: ["essential", "baseline"],
    compatible_tools: ["cursor", "claude-code", "warp", "windsurf"],
    license: "MIT",
    maintainer: {
      name: "AlignTrue",
      github: "aligntrue",
    },
    last_updated: "2025-10-31T10:00:00Z",
    source_repo: "https://github.com/AlignTrue/aligns",
    source_linked: true,
    stats: {
      copies_7d: 50,
    },
    has_plugs: false,
    overlay_friendly: true,
    required_plugs_count: 0,
    exporters: [],
  };

  it("should render pack name and version", () => {
    render(<PackCard pack={mockPack} />);
    expect(screen.getByText("Base Global")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("should render description", () => {
    render(<PackCard pack={mockPack} />);
    expect(
      screen.getByText("Essential rules for all projects"),
    ).toBeInTheDocument();
  });

  it("should render categories", () => {
    render(<PackCard pack={mockPack} />);
    expect(screen.getByText(/code quality/i)).toBeInTheDocument();
    expect(screen.getByText(/security/i)).toBeInTheDocument();
  });

  it("should show source linked badge", () => {
    render(<PackCard pack={mockPack} />);
    expect(screen.getByText("Source Linked")).toBeInTheDocument();
  });

  it("should show overlay friendly badge", () => {
    render(<PackCard pack={mockPack} />);
    expect(screen.getByText("Overlay Friendly")).toBeInTheDocument();
  });

  it("should render stats", () => {
    render(<PackCard pack={mockPack} />);
    expect(screen.getByText("50 copies/7d")).toBeInTheDocument();
  });

  it("should show 'New' when no copies", () => {
    const newPack = { ...mockPack, stats: { copies_7d: 0 } };
    render(<PackCard pack={newPack} />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("should render license", () => {
    render(<PackCard pack={mockPack} />);
    expect(screen.getByText("MIT")).toBeInTheDocument();
  });

  it("should render maintainer", () => {
    render(<PackCard pack={mockPack} />);
    expect(screen.getByText("AlignTrue")).toBeInTheDocument();
    expect(screen.getByText("@aligntrue")).toBeInTheDocument();
  });

  it("should render compatible tools (limited to 4)", () => {
    render(<PackCard pack={mockPack} />);
    expect(screen.getByText("cursor")).toBeInTheDocument();
    expect(screen.getByText("claude-code")).toBeInTheDocument();
    expect(screen.getByText("warp")).toBeInTheDocument();
    expect(screen.getByText("windsurf")).toBeInTheDocument();
  });

  it("should call onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PackCard pack={mockPack} onClick={onClick} />);

    const card = screen.getByRole("button");
    await user.click(card);

    expect(onClick).toHaveBeenCalledWith(mockPack);
  });

  it("should call onClick on Enter key", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PackCard pack={mockPack} onClick={onClick} />);

    const card = screen.getByRole("button");
    card.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledWith(mockPack);
  });

  it("should call onClick on Space key", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<PackCard pack={mockPack} onClick={onClick} />);

    const card = screen.getByRole("button");
    card.focus();
    await user.keyboard(" ");

    expect(onClick).toHaveBeenCalledWith(mockPack);
  });

  it("should not be interactive without onClick", () => {
    render(<PackCard pack={mockPack} />);
    const card = screen.getByRole("article");
    expect(card).not.toHaveAttribute("tabIndex");
  });

  it("should show +N more for excess categories", () => {
    const packWithManyCategories = {
      ...mockPack,
      categories: ["cat1", "cat2", "cat3", "cat4", "cat5"],
    };
    render(<PackCard pack={packWithManyCategories} />);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("should show +N more for excess tools", () => {
    const packWithManyTools = {
      ...mockPack,
      compatible_tools: ["tool1", "tool2", "tool3", "tool4", "tool5"],
    };
    render(<PackCard pack={packWithManyTools} />);
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });
});
