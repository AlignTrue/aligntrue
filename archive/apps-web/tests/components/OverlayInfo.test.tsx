import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayInfo } from "@/components/catalog/OverlayInfo";

describe("OverlayInfo", () => {
  describe("Basic rendering", () => {
    it("renders overlay info section", () => {
      render(<OverlayInfo packId="test/pack" />);

      expect(
        screen.getByRole("heading", { name: /overlay-friendly pack/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/non-destructive way to customize/i),
      ).toBeInTheDocument();
    });

    it("uses semantic HTML structure", () => {
      render(<OverlayInfo packId="test/pack" />);

      const section = screen.getByRole("region", {
        name: /overlay-friendly pack/i,
      });
      expect(section).toBeInTheDocument();
    });

    it("includes visual badge/icon", () => {
      render(<OverlayInfo packId="test/pack" />);

      expect(screen.getByText("⚡")).toBeInTheDocument();
    });
  });

  describe("Rules index display", () => {
    it("displays rules count when rulesIndex provided", () => {
      const rulesIndex = [
        { id: "security/input-validation", content_sha: "abc123" },
        { id: "performance/caching", content_sha: "def456" },
        { id: "testing/coverage", content_sha: "ghi789" },
      ];

      render(<OverlayInfo packId="test/pack" rulesIndex={rulesIndex} />);

      expect(screen.getByText(/3 customizable rules/i)).toBeInTheDocument();
    });

    it("uses singular form for single rule", () => {
      const rulesIndex = [{ id: "single-rule", content_sha: "abc123" }];

      render(<OverlayInfo packId="test/pack" rulesIndex={rulesIndex} />);

      expect(screen.getByText(/1 customizable rule/i)).toBeInTheDocument();
    });

    it("does not display count when rulesIndex empty", () => {
      render(<OverlayInfo packId="test/pack" rulesIndex={[]} />);

      expect(screen.queryByText(/customizable rules/i)).not.toBeInTheDocument();
    });

    it("does not display count when rulesIndex undefined", () => {
      render(<OverlayInfo packId="test/pack" />);

      expect(screen.queryByText(/customizable rules/i)).not.toBeInTheDocument();
    });
  });

  describe("Example overlay snippet", () => {
    it("renders collapsible example snippet", async () => {
      const user = userEvent.setup();
      render(<OverlayInfo packId="test/pack" />);

      const details = screen.getByRole("group");
      expect(details.tagName).toBe("DETAILS");

      const summary = screen.getByText(/example overlay snippet/i);
      expect(summary).toBeInTheDocument();

      // Details should be closed by default (check open attribute, not element absence)
      expect(details).not.toHaveAttribute("open");

      // Expand
      await user.click(summary);
      expect(
        screen.getByLabelText(/example overlay configuration/i),
      ).toBeInTheDocument();
    });

    it("includes pack ID in example snippet", async () => {
      const user = userEvent.setup();
      render(<OverlayInfo packId="aligntrue/typescript-strict" />);

      await user.click(screen.getByText(/example overlay snippet/i));

      expect(
        screen.getByText(/catalog:aligntrue\/typescript-strict/i),
      ).toBeInTheDocument();
    });

    it("provides ARIA label for code block", async () => {
      const user = userEvent.setup();
      render(<OverlayInfo packId="test/pack" />);

      await user.click(screen.getByText(/example overlay snippet/i));

      const pre = screen.getByLabelText(/example overlay configuration/i);
      expect(pre).toBeInTheDocument();
      expect(pre.tagName).toBe("PRE");
    });

    it("shows realistic overlay syntax", async () => {
      const user = userEvent.setup();
      render(<OverlayInfo packId="test/pack" />);

      await user.click(screen.getByText(/example overlay snippet/i));

      const code = screen.getByText(/spec_version/i).closest("code");
      expect(code?.textContent).toMatch(/spec_version: "1"/);
      expect(code?.textContent).toMatch(/rules:/);
      expect(code?.textContent).toMatch(/overlays:/);
      expect(code?.textContent).toMatch(/target_rule:/);
      expect(code?.textContent).toMatch(/severity:/);
      expect(code?.textContent).toMatch(/add_content:/);
    });
  });

  describe("Documentation link", () => {
    it("provides link to overlays documentation", () => {
      render(<OverlayInfo packId="test/pack" />);

      const link = screen.getByRole("link", {
        name: /learn more about overlays/i,
      });
      expect(link).toHaveAttribute("href", "/docs/overlays");
    });

    it("uses accessible link text", () => {
      render(<OverlayInfo packId="test/pack" />);

      const link = screen.getByRole("link", {
        name: /learn more about overlays/i,
      });
      expect(link).toHaveAccessibleName();
    });
  });

  describe("Educational content", () => {
    it("explains overlay benefits", () => {
      render(<OverlayInfo packId="test/pack" />);

      expect(
        screen.getByText(/non-destructive way to customize/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/without forking/i)).toBeInTheDocument();
      expect(
        screen.getByText(/staying synced with upstream/i),
      ).toBeInTheDocument();
    });

    it("emphasizes key concepts with strong tags", () => {
      const { container } = render(<OverlayInfo packId="test/pack" />);

      const strongElements = container.querySelectorAll("strong");
      expect(strongElements.length).toBeGreaterThan(0);

      const strongTexts = Array.from(strongElements).map(
        (el) => el.textContent,
      );
      expect(strongTexts).toContain("overlays");
    });
  });

  describe("Visual design", () => {
    it("uses blue color scheme for callout", () => {
      const { container } = render(<OverlayInfo packId="test/pack" />);

      const section = container.querySelector("section");
      expect(section?.className).toMatch(/bg-blue-50/);
      expect(section?.className).toMatch(/border-blue-200/);
    });

    it("includes icon with proper styling", () => {
      const { container } = render(<OverlayInfo packId="test/pack" />);

      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
      expect(icon?.className).toMatch(/bg-blue-600/);
      expect(icon?.className).toMatch(/rounded-full/);
    });
  });

  describe("Accessibility", () => {
    it("uses proper heading hierarchy", () => {
      render(<OverlayInfo packId="test/pack" />);

      const heading = screen.getByRole("heading", {
        level: 2,
        name: /overlay-friendly pack/i,
      });
      expect(heading).toBeInTheDocument();
    });

    it("provides region landmark", () => {
      render(<OverlayInfo packId="test/pack" />);

      const region = screen.getByRole("region", {
        name: /overlay-friendly pack/i,
      });
      expect(region).toBeInTheDocument();
    });

    it("uses semantic details/summary for disclosure", () => {
      const { container } = render(<OverlayInfo packId="test/pack" />);

      const details = container.querySelector("details");
      const summary = container.querySelector("summary");

      expect(details).toBeInTheDocument();
      expect(summary).toBeInTheDocument();
      expect(summary?.parentElement).toBe(details);
    });

    it("ensures links have accessible names", () => {
      render(<OverlayInfo packId="test/pack" />);

      const link = screen.getByRole("link", {
        name: /learn more about overlays/i,
      });
      expect(link).toHaveAttribute("aria-label");
    });
  });

  describe("Edge cases", () => {
    it("handles empty pack ID gracefully", () => {
      render(<OverlayInfo packId="" />);

      expect(
        screen.getByRole("heading", { name: /overlay-friendly pack/i }),
      ).toBeInTheDocument();
    });

    it("handles pack ID with special characters", async () => {
      const user = userEvent.setup();
      render(<OverlayInfo packId="org/pack-name_v2" />);

      await user.click(screen.getByText(/example overlay snippet/i));

      expect(
        screen.getByText(/catalog:org\/pack-name_v2/i),
      ).toBeInTheDocument();
    });

    it("handles large rules index", () => {
      const largeIndex = Array.from({ length: 100 }, (_, i) => ({
        id: `rule-${i}`,
        content_sha: `sha-${i}`,
      }));

      render(<OverlayInfo packId="test/pack" rulesIndex={largeIndex} />);

      expect(screen.getByText(/100 customizable rules/i)).toBeInTheDocument();
    });
  });
});
