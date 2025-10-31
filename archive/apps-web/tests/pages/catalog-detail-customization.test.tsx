import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PackDetailPage from "@/app/catalog/[slug]/page";
import type { CatalogEntryExtended } from "@aligntrue/schema";

// Mock Next.js hooks
vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  })),
}));

const { useParams } = await import("next/navigation");

// Mock fetch
global.fetch = vi.fn();

describe("PackDetailPage - Customization Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PlugsPanel integration", () => {
    it("renders plugs panel when pack has plugs", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/with-plugs",
        slug: "with-plugs",
        name: "Pack with Plugs",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: false,
        stats: { copies_7d: 0 },
        plugs: [
          {
            key: "project_name",
            description: "Project name",
            type: "string",
            required: true,
          },
          {
            key: "debug_mode",
            description: "Enable debugging",
            type: "boolean",
            default: false,
          },
        ],
      };

      vi.mocked(useParams).mockReturnValue({ slug: "with-plugs" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /customization \(2 plugs\)/i }),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("project_name")).toBeInTheDocument();
      expect(screen.getByText("debug_mode")).toBeInTheDocument();
    });

    it("does not render plugs panel when pack has no plugs", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/no-plugs",
        slug: "no-plugs",
        name: "Pack without Plugs",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: false,
        stats: { copies_7d: 0 },
        plugs: [],
      };

      vi.mocked(useParams).mockReturnValue({ slug: "no-plugs" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /pack without plugs/i }),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/customization \(\d+ plugs?\)/i),
      ).not.toBeInTheDocument();
    });

    it("renders plugs panel in right sidebar", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/sidebar-test",
        slug: "sidebar-test",
        name: "Sidebar Test",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: false,
        stats: { copies_7d: 0 },
        plugs: [{ key: "test", description: "Test plug" }],
      };

      vi.mocked(useParams).mockReturnValue({ slug: "sidebar-test" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      const { container } = render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /customization/i }),
        ).toBeInTheDocument();
      });

      // Verify layout structure
      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toBeInTheDocument();

      const sidebarColumn = container.querySelector(".space-y-8");
      expect(sidebarColumn).toBeInTheDocument();
    });
  });

  describe("OverlayInfo integration", () => {
    it("renders overlay info when pack is overlay_friendly", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/overlay-pack",
        slug: "overlay-pack",
        name: "Overlay Pack",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: true,
        stats: { copies_7d: 0 },
        rules_index: {
          "rule-1": { id: "rule-1" },
          "rule-2": { id: "rule-2" },
        },
      };

      vi.mocked(useParams).mockReturnValue({ slug: "overlay-pack" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /overlay-friendly pack/i }),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(/non-destructive way to customize/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/2 customizable rules/i)).toBeInTheDocument();
    });

    it("does not render overlay info when pack is not overlay_friendly", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/no-overlay",
        slug: "no-overlay",
        name: "No Overlay Pack",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: false,
        stats: { copies_7d: 0 },
      };

      vi.mocked(useParams).mockReturnValue({ slug: "no-overlay" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /no overlay pack/i }),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("heading", { name: /overlay-friendly pack/i }),
      ).not.toBeInTheDocument();
    });

    it("renders overlay info in main content area", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/layout-test",
        slug: "layout-test",
        name: "Layout Test",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: true,
        stats: { copies_7d: 0 },
      };

      vi.mocked(useParams).mockReturnValue({ slug: "layout-test" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      const { container } = render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /overlay-friendly pack/i }),
        ).toBeInTheDocument();
      });

      // Verify overlay info is in main content (left column, 2/3 width)
      const mainColumn = container.querySelector(".lg\\:col-span-2");
      expect(mainColumn).toBeInTheDocument();
      expect(mainColumn?.textContent).toMatch(/overlay-friendly pack/i);
    });
  });

  describe("Combined customization features", () => {
    it("renders both plugs and overlay info when pack has both", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/full-featured",
        slug: "full-featured",
        name: "Full Featured Pack",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: true,
        overlay_friendly: true,
        stats: { copies_7d: 10 },
        plugs: [
          { key: "config", description: "Configuration", required: true },
        ],
        rules_index: {
          "rule-1": { id: "rule-1" },
        },
      };

      vi.mocked(useParams).mockReturnValue({ slug: "full-featured" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /full featured pack/i }),
        ).toBeInTheDocument();
      });

      // Both components should be rendered
      expect(
        screen.getByRole("heading", { name: /overlay-friendly pack/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /customization \(1 plug\)/i }),
      ).toBeInTheDocument();

      // Badges should be visible
      expect(screen.getByText(/source linked/i)).toBeInTheDocument();
      expect(screen.getByText(/overlay friendly/i)).toBeInTheDocument();
    });

    it("maintains layout with all components present", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/complete",
        slug: "complete",
        name: "Complete Pack",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: ["Bullet 1", "Bullet 2"],
        categories: ["testing"],
        compatible_tools: ["cursor", "windsurf"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: true,
        overlay_friendly: true,
        stats: { copies_7d: 25 },
        plugs: [
          { key: "plug1", description: "Plug 1" },
          { key: "plug2", description: "Plug 2" },
        ],
        rules_index: {
          "rule-1": { id: "rule-1" },
          "rule-2": { id: "rule-2" },
          "rule-3": { id: "rule-3" },
        },
      };

      vi.mocked(useParams).mockReturnValue({ slug: "complete" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack], related_packs: [] }),
      } as Response);

      const { container } = render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /complete pack/i }),
        ).toBeInTheDocument();
      });

      // Verify all major components are present
      expect(
        screen.getByRole("heading", { name: /overlay-friendly pack/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /customization \(2 plugs\)/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/install this pack/i)).toBeInTheDocument();

      // Verify grid layout exists
      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
      expect(grid?.className).toMatch(/lg:grid-cols-3/);
    });
  });

  describe("Responsive behavior", () => {
    it("maintains proper column layout with customization components", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/responsive",
        slug: "responsive",
        name: "Responsive Pack",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: true,
        stats: { copies_7d: 0 },
        plugs: [{ key: "test", description: "Test" }],
      };

      vi.mocked(useParams).mockReturnValue({ slug: "responsive" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      const { container } = render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /responsive pack/i }),
        ).toBeInTheDocument();
      });

      // Verify responsive grid classes
      const grid = container.querySelector(".grid");
      expect(grid?.className).toMatch(/grid-cols-1/); // Mobile: single column
      expect(grid?.className).toMatch(/lg:grid-cols-3/); // Desktop: 3 columns

      // Verify column span classes
      const mainColumn = container.querySelector(".lg\\:col-span-2");
      expect(mainColumn).toBeInTheDocument();
    });
  });

  describe("Accessibility with customization components", () => {
    it("maintains proper heading hierarchy with all components", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/a11y",
        slug: "a11y",
        name: "Accessibility Pack",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: true,
        stats: { copies_7d: 0 },
        plugs: [{ key: "test", description: "Test" }],
      };

      vi.mocked(useParams).mockReturnValue({ slug: "a11y" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      render(<PackDetailPage />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      });

      // All h2 headings should be present
      const h2Headings = screen.getAllByRole("heading", { level: 2 });
      expect(h2Headings.length).toBeGreaterThan(0);

      const headingTexts = h2Headings.map((h) => h.textContent);
      expect(headingTexts).toContain("Overlay-Friendly Pack");
      expect(headingTexts).toContain("Customization (1 plug)");
    });

    it("provides landmarks for all major sections", async () => {
      const mockPack: CatalogEntryExtended = {
        id: "test/landmarks",
        slug: "landmarks",
        name: "Landmarks Pack",
        version: "1.0.0",
        description: "Test pack",
        summary_bullets: [],
        categories: ["testing"],
        compatible_tools: ["cursor"],
        license: "CC0-1.0",
        maintainer: { name: "Test", github: "test" },
        last_updated: "2025-10-31",
        source_linked: false,
        overlay_friendly: true,
        stats: { copies_7d: 0 },
        plugs: [{ key: "test", description: "Test" }],
      };

      vi.mocked(useParams).mockReturnValue({ slug: "landmarks" });
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      } as Response);

      render(<PackDetailPage />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /landmarks pack/i }),
        ).toBeInTheDocument();
      });

      // Verify region landmarks exist
      const regions = screen.getAllByRole("region");
      expect(regions.length).toBeGreaterThan(0);
    });
  });
});
