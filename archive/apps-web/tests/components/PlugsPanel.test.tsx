import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlugsPanel, type Plug } from "@/components/catalog/PlugsPanel";

describe("PlugsPanel", () => {
  describe("Empty state", () => {
    it("renders empty state when no plugs provided", () => {
      render(<PlugsPanel plugs={[]} />);

      expect(
        screen.getByRole("heading", { name: /customization/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/this pack has no plugs/i)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /learn about plugs/i }),
      ).toHaveAttribute("href", "/docs/plugs");
    });

    it("uses correct semantic HTML for empty state", () => {
      render(<PlugsPanel plugs={[]} />);

      const section = screen.getByRole("region", { name: /customization/i });
      expect(section).toBeInTheDocument();
    });
  });

  describe("Required plugs", () => {
    const requiredPlugs: Plug[] = [
      {
        key: "project_name",
        description: "Name of the project",
        type: "string",
        required: true,
      },
      {
        key: "api_version",
        description: "API version to target",
        type: "string",
        default: "v1",
        required: true,
      },
    ];

    it("renders required plugs with bold font and label", () => {
      render(<PlugsPanel plugs={requiredPlugs} />);

      expect(
        screen.getByRole("heading", { name: /required plugs/i }),
      ).toBeInTheDocument();

      const projectName = screen.getByRole("heading", {
        name: /project_name/i,
      });
      expect(projectName).toHaveClass("font-bold");
      expect(screen.getByText(/\(required\)/i)).toBeInTheDocument();
    });

    it("displays plug descriptions", () => {
      render(<PlugsPanel plugs={requiredPlugs} />);

      expect(screen.getByText("Name of the project")).toBeInTheDocument();
      expect(screen.getByText("API version to target")).toBeInTheDocument();
    });

    it("shows expand button for plugs with metadata", async () => {
      const user = userEvent.setup();
      render(<PlugsPanel plugs={requiredPlugs} />);

      const expandButtons = screen.getAllByRole("button", {
        name: /show details/i,
      });
      expect(expandButtons).toHaveLength(2);

      await user.click(expandButtons[1]);

      expect(screen.getByText("Type:")).toBeInTheDocument();
      expect(screen.getByText("string")).toBeInTheDocument();
      expect(screen.getByText("Default:")).toBeInTheDocument();
      expect(screen.getByText('"v1"')).toBeInTheDocument();
    });

    it("toggles expand/collapse on button click", async () => {
      const user = userEvent.setup();
      render(<PlugsPanel plugs={requiredPlugs} />);

      const expandButton = screen.getAllByRole("button", {
        name: /show details/i,
      })[0];

      expect(expandButton).toHaveAttribute("aria-expanded", "false");
      await user.click(expandButton);
      expect(expandButton).toHaveAttribute("aria-expanded", "true");

      await user.click(expandButton);
      expect(expandButton).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("Optional plugs", () => {
    const optionalPlugs: Plug[] = [
      {
        key: "debug_mode",
        description: "Enable debug logging",
        type: "boolean",
        default: false,
        required: false,
      },
      {
        key: "timeout",
        description: "Request timeout in milliseconds",
        type: "number",
        default: 5000,
        scope: "global",
      },
    ];

    it("renders optional plugs with normal font weight", () => {
      render(<PlugsPanel plugs={optionalPlugs} />);

      expect(
        screen.getByRole("heading", { name: /optional plugs/i }),
      ).toBeInTheDocument();

      const debugMode = screen.getByRole("heading", { name: /debug_mode/i });
      expect(debugMode).not.toHaveClass("font-bold");
      expect(debugMode).toHaveClass("font-normal");
    });

    it("does not show required label for optional plugs", () => {
      render(<PlugsPanel plugs={optionalPlugs} />);

      const articles = screen.getAllByRole("article");
      articles.forEach((article) => {
        expect(
          within(article).queryByText(/\(required\)/i),
        ).not.toBeInTheDocument();
      });
    });

    it("displays all metadata when expanded", async () => {
      const user = userEvent.setup();
      render(<PlugsPanel plugs={optionalPlugs} />);

      const expandButton = screen.getAllByRole("button", {
        name: /show details/i,
      })[1];
      await user.click(expandButton);

      expect(screen.getByText("Type:")).toBeInTheDocument();
      expect(screen.getByText("number")).toBeInTheDocument();
      expect(screen.getByText("Default:")).toBeInTheDocument();
      expect(screen.getByText("5000")).toBeInTheDocument();
      expect(screen.getByText("Scope:")).toBeInTheDocument();
      expect(screen.getByText("global")).toBeInTheDocument();
    });
  });

  describe("Mixed plugs", () => {
    const mixedPlugs: Plug[] = [
      {
        key: "required_key",
        description: "Required configuration",
        required: true,
      },
      {
        key: "optional_key",
        description: "Optional configuration",
        required: false,
      },
    ];

    it("separates required and optional plugs into sections", () => {
      render(<PlugsPanel plugs={mixedPlugs} />);

      expect(
        screen.getByRole("heading", { name: /required plugs/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /optional plugs/i }),
      ).toBeInTheDocument();
    });

    it("displays correct count in heading", () => {
      render(<PlugsPanel plugs={mixedPlugs} />);

      expect(
        screen.getByRole("heading", { name: /customization \(2 plugs\)/i }),
      ).toBeInTheDocument();
    });

    it("uses singular form for single plug", () => {
      const singlePlug: Plug[] = [
        { key: "only_one", description: "Single plug", required: true },
      ];

      render(<PlugsPanel plugs={singlePlug} />);

      expect(
        screen.getByRole("heading", { name: /customization \(1 plug\)/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    const testPlugs: Plug[] = [
      {
        key: "test_plug",
        description: "Test description",
        type: "string",
        required: true,
      },
    ];

    it("uses semantic HTML structure", () => {
      render(<PlugsPanel plugs={testPlugs} />);

      expect(
        screen.getByRole("region", { name: /customization/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("article")).toBeInTheDocument();
    });

    it("provides ARIA labels for expand/collapse buttons", () => {
      render(<PlugsPanel plugs={testPlugs} />);

      const button = screen.getByRole("button", { name: /show details/i });
      expect(button).toHaveAttribute("aria-expanded", "false");
      expect(button).toHaveAttribute("aria-controls", "plug-test_plug-details");
    });

    it("links plug name to details with aria-labelledby", () => {
      render(<PlugsPanel plugs={testPlugs} />);

      const article = screen.getByRole("article");
      expect(article).toHaveAttribute("aria-labelledby", "plug-test_plug-name");

      const heading = screen.getByRole("heading", { name: /test_plug/i });
      expect(heading).toHaveAttribute("id", "plug-test_plug-name");
    });

    it("uses description list for metadata", async () => {
      const user = userEvent.setup();
      render(<PlugsPanel plugs={testPlugs} />);

      const button = screen.getByRole("button", { name: /show details/i });
      await user.click(button);

      const dl = screen.getByRole("list");
      expect(dl.tagName).toBe("DL");
    });

    it("provides link to documentation", () => {
      render(<PlugsPanel plugs={testPlugs} />);

      const link = screen.getByRole("link", { name: /learn about plugs/i });
      expect(link).toHaveAttribute("href", "/docs/plugs");
    });
  });

  describe("Edge cases", () => {
    it("handles plug with no metadata gracefully", () => {
      const minimalPlug: Plug[] = [
        { key: "minimal", description: "Minimal plug" },
      ];

      render(<PlugsPanel plugs={minimalPlug} />);

      expect(screen.getByText("minimal")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /show details/i }),
      ).not.toBeInTheDocument();
    });

    it("formats complex default values as JSON", async () => {
      const user = userEvent.setup();
      const complexPlug: Plug[] = [
        {
          key: "config",
          description: "Complex configuration",
          default: { nested: { value: 123 }, array: [1, 2, 3] },
        },
      ];

      render(<PlugsPanel plugs={complexPlug} />);

      const button = screen.getByRole("button", { name: /show details/i });
      await user.click(button);

      expect(
        screen.getByText(/{"nested":{"value":123},"array":\[1,2,3\]}/),
      ).toBeInTheDocument();
    });

    it("handles null and undefined defaults", async () => {
      const user = userEvent.setup();
      const nullPlug: Plug[] = [
        {
          key: "nullable",
          description: "Nullable config",
          default: null,
        },
      ];

      render(<PlugsPanel plugs={nullPlug} />);

      const button = screen.getByRole("button", { name: /show details/i });
      await user.click(button);

      expect(screen.getByText("null")).toBeInTheDocument();
    });
  });
});
