/**
 * RelatedPacks component tests (Phase 4, Session 3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RelatedPacks } from "@/components/catalog/RelatedPacks";
import type { CatalogEntryExtended } from "@aligntrue/schema";

describe("RelatedPacks", () => {
  const createMockPack = (
    overrides: Partial<CatalogEntryExtended> = {},
  ): CatalogEntryExtended => ({
    id: "pack-1",
    version: "1.0.0",
    name: "Pack 1",
    slug: "pack-1",
    description: "Test pack",
    summary_bullets: [],
    categories: ["code-quality"],
    tags: ["test"],
    compatible_tools: ["cursor"],
    license: "MIT",
    maintainer: {
      name: "Maintainer",
      github: "maintainer",
    },
    last_updated: "2025-10-31T10:00:00Z",
    stats: {
      copies_7d: 10,
    },
    has_plugs: false,
    overlay_friendly: false,
    required_plugs_count: 0,
    exporters: [],
    ...overrides,
  });

  const currentPack = createMockPack({
    id: "current-pack",
    name: "Current Pack",
    slug: "current-pack",
    categories: ["code-quality", "security"],
    compatible_tools: ["cursor", "claude-code"],
  });

  const relatedPack1 = createMockPack({
    id: "related-1",
    name: "Related Pack 1",
    slug: "related-1",
    description: "Similar pack with shared categories",
    categories: ["code-quality", "security"], // Same categories
    compatible_tools: ["cursor"], // Shared tool
    stats: { copies_7d: 25 },
  });

  const relatedPack2 = createMockPack({
    id: "related-2",
    name: "Related Pack 2",
    slug: "related-2",
    description: "Another related pack",
    categories: ["security"], // One shared category
    compatible_tools: ["claude-code"], // One shared tool
    stats: { copies_7d: 15 },
  });

  const unrelatedPack = createMockPack({
    id: "unrelated",
    name: "Unrelated Pack",
    slug: "unrelated",
    description: "Completely different",
    categories: ["documentation"], // No shared categories
    compatible_tools: ["warp"], // No shared tools
    stats: { copies_7d: 5 },
  });

  // Mock window.location.href
  let locationHref = "";
  beforeEach(() => {
    locationHref = "";
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        href: "",
        get href() {
          return locationHref;
        },
        set href(value: string) {
          locationHref = value;
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render related packs section heading", () => {
    const allPacks = [currentPack, relatedPack1, relatedPack2, unrelatedPack];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);
    expect(
      screen.getByRole("heading", { name: "Related packs" }),
    ).toBeInTheDocument();
  });

  it("should show packs with shared categories", () => {
    const allPacks = [currentPack, relatedPack1, relatedPack2, unrelatedPack];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);
    expect(screen.getByText("Related Pack 1")).toBeInTheDocument();
    expect(screen.getByText("Related Pack 2")).toBeInTheDocument();
  });

  it("should not show packs with no similarity", () => {
    const allPacks = [currentPack, relatedPack1, relatedPack2, unrelatedPack];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);
    expect(screen.queryByText("Unrelated Pack")).not.toBeInTheDocument();
  });

  it("should not show current pack in related packs", () => {
    const allPacks = [currentPack, relatedPack1, relatedPack2];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);
    expect(screen.queryByText("Current Pack")).not.toBeInTheDocument();
  });

  it("should rank packs by similarity score", () => {
    const allPacks = [currentPack, relatedPack1, relatedPack2, unrelatedPack];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);

    // Related Pack 1 has higher similarity (2 shared categories + 1 shared tool)
    // than Related Pack 2 (1 shared category + 1 shared tool)
    const cards = screen.getAllByRole("button");
    expect(cards[0]).toHaveTextContent("Related Pack 1");
    expect(cards[1]).toHaveTextContent("Related Pack 2");
  });

  it("should limit to maxPacks (default 4)", () => {
    const manyRelatedPacks = [
      currentPack,
      ...Array.from({ length: 10 }, (_, i) =>
        createMockPack({
          id: `related-${i}`,
          name: `Related Pack ${i}`,
          slug: `related-${i}`,
          categories: ["code-quality"], // Shared category
        }),
      ),
    ];
    render(
      <RelatedPacks currentPack={currentPack} allPacks={manyRelatedPacks} />,
    );

    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(4);
  });

  it("should respect custom maxPacks prop", () => {
    const manyRelatedPacks = [
      currentPack,
      ...Array.from({ length: 10 }, (_, i) =>
        createMockPack({
          id: `related-${i}`,
          name: `Related Pack ${i}`,
          slug: `related-${i}`,
          categories: ["code-quality"],
        }),
      ),
    ];
    render(
      <RelatedPacks
        currentPack={currentPack}
        allPacks={manyRelatedPacks}
        maxPacks={2}
      />,
    );

    const cards = screen.getAllByRole("button");
    expect(cards).toHaveLength(2);
  });

  it("should display pack metadata in compact card", () => {
    const allPacks = [currentPack, relatedPack1];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);

    expect(screen.getByText("Related Pack 1")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(
      screen.getByText("Similar pack with shared categories"),
    ).toBeInTheDocument();
    expect(screen.getByText("25 copies/7d")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
  });

  it('should show "New" for packs with zero copies', () => {
    const newPack = createMockPack({
      id: "new-pack",
      name: "New Pack",
      slug: "new-pack",
      categories: ["code-quality"],
      stats: { copies_7d: 0 },
    });
    const allPacks = [currentPack, newPack];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("should navigate to detail page on click", async () => {
    const user = userEvent.setup();
    const allPacks = [currentPack, relatedPack1];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);

    const card = screen.getByRole("button", {
      name: /View details for Related Pack 1/i,
    });
    await user.click(card);

    expect(locationHref).toBe("/catalog/related-1");
  });

  it("should navigate on Enter key", async () => {
    const user = userEvent.setup();
    const allPacks = [currentPack, relatedPack1];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);

    const card = screen.getByRole("button", {
      name: /View details for Related Pack 1/i,
    });
    card.focus();
    await user.keyboard("{Enter}");

    expect(locationHref).toBe("/catalog/related-1");
  });

  it("should navigate on Space key", async () => {
    const user = userEvent.setup();
    const allPacks = [currentPack, relatedPack1];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);

    const card = screen.getByRole("button", {
      name: /View details for Related Pack 1/i,
    });
    card.focus();
    await user.keyboard(" ");

    expect(locationHref).toBe("/catalog/related-1");
  });

  it("should render nothing when no related packs found", () => {
    const allPacks = [currentPack, unrelatedPack];
    const { container } = render(
      <RelatedPacks currentPack={currentPack} allPacks={allPacks} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should boost similarity for same maintainer", () => {
    const sameMaintainerPack = createMockPack({
      id: "same-maintainer",
      name: "Same Maintainer Pack",
      slug: "same-maintainer",
      categories: ["documentation"], // Different category
      maintainer: {
        name: "Maintainer",
        github: "maintainer", // Same as currentPack
      },
    });

    const differentMaintainerPack = createMockPack({
      id: "different-maintainer",
      name: "Different Maintainer Pack",
      slug: "different-maintainer",
      categories: ["documentation"], // Same category as sameMaintainerPack
      maintainer: {
        name: "Other",
        github: "other",
      },
    });

    // Give currentPack a specific maintainer
    const packWithMaintainer = createMockPack({
      ...currentPack,
      maintainer: {
        name: "Maintainer",
        github: "maintainer",
      },
    });

    const allPacks = [
      packWithMaintainer,
      sameMaintainerPack,
      differentMaintainerPack,
    ];

    render(
      <RelatedPacks
        currentPack={packWithMaintainer}
        allPacks={allPacks}
        maxPacks={2}
      />,
    );

    // Same maintainer should appear (even with different category)
    expect(screen.getByText("Same Maintainer Pack")).toBeInTheDocument();
  });

  it("should have accessible labels on compact cards", () => {
    const allPacks = [currentPack, relatedPack1];
    render(<RelatedPacks currentPack={currentPack} allPacks={allPacks} />);

    const card = screen.getByRole("button", {
      name: /View details for Related Pack 1/i,
    });
    expect(card).toHaveAttribute("tabindex", "0");
  });
});
