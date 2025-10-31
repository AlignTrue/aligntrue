/**
 * ExporterPreview component tests (Phase 4, Session 3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExporterPreview } from "@/components/catalog/ExporterPreview";
import type { CatalogEntryExtended } from "@aligntrue/schema";

describe("ExporterPreview", () => {
  const mockPack: CatalogEntryExtended = {
    id: "packs/base/base-global",
    version: "1.0.0",
    name: "Base Global",
    slug: "base-global",
    description: "Essential rules for all projects",
    summary_bullets: ["Code quality", "Security", "Best practices"],
    categories: ["code-quality"],
    tags: ["essential"],
    compatible_tools: ["cursor"],
    license: "MIT",
    maintainer: {
      name: "AlignTrue",
      github: "aligntrue",
    },
    last_updated: "2025-10-31T10:00:00Z",
    stats: {
      copies_7d: 50,
    },
    has_plugs: false,
    overlay_friendly: false,
    required_plugs_count: 0,
    exporters: [
      {
        format: "yaml",
        preview: "spec_version: 1\nrules:\n  - id: test-rule",
        preview_meta: {
          engine_version: "0.1.0",
          canonical_yaml_sha:
            "abc123def456789012345678901234567890123456789012345678901234",
          rendered_at: "2025-10-31T10:00:00Z",
        },
      },
      {
        format: "cursor",
        preview: "# Cursor Rules\n\nTest rule content",
        preview_meta: {
          engine_version: "0.1.0",
          canonical_yaml_sha:
            "abc123def456789012345678901234567890123456789012345678901234",
          rendered_at: "2025-10-31T10:00:00Z",
        },
      },
    ],
  };

  // Mock clipboard API
  let clipboardText = "";
  beforeEach(() => {
    clipboardText = "";
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn((text: string) => {
          clipboardText = text;
          return Promise.resolve();
        }),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render tab navigation for all exporters", () => {
    render(<ExporterPreview pack={mockPack} />);
    expect(screen.getByRole("tab", { name: /YAML/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Cursor/i })).toBeInTheDocument();
  });

  it("should show first exporter preview by default", () => {
    render(<ExporterPreview pack={mockPack} />);
    expect(screen.getByText(/spec_version: 1/)).toBeInTheDocument();
  });

  it("should switch preview when clicking tabs", async () => {
    const user = userEvent.setup();
    render(<ExporterPreview pack={mockPack} />);

    // Click Cursor tab
    await user.click(screen.getByRole("tab", { name: /Cursor/i }));

    // Should show Cursor preview
    expect(screen.getByText(/# Cursor Rules/)).toBeInTheDocument();
  });

  it("should switch preview with keyboard (Enter key)", async () => {
    const user = userEvent.setup();
    render(<ExporterPreview pack={mockPack} />);

    const cursorTab = screen.getByRole("tab", { name: /Cursor/i });
    cursorTab.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText(/# Cursor Rules/)).toBeInTheDocument();
  });

  it("should switch preview with keyboard (Space key)", async () => {
    const user = userEvent.setup();
    render(<ExporterPreview pack={mockPack} />);

    const cursorTab = screen.getByRole("tab", { name: /Cursor/i });
    cursorTab.focus();
    await user.keyboard(" ");

    expect(screen.getByText(/# Cursor Rules/)).toBeInTheDocument();
  });

  it("should copy preview to clipboard", async () => {
    const user = userEvent.setup();
    render(<ExporterPreview pack={mockPack} />);

    const copyButton = screen.getByRole("button", {
      name: /Copy preview to clipboard/i,
    });
    await user.click(copyButton);

    await waitFor(() => {
      expect(clipboardText).toContain("spec_version: 1");
    });
  });

  it("should show success message after copying", async () => {
    const user = userEvent.setup();
    render(<ExporterPreview pack={mockPack} />);

    const copyButton = screen.getByRole("button", {
      name: /Copy preview to clipboard/i,
    });
    await user.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText("✓ Copied!")).toBeInTheDocument();
    });
  });

  it("should display provenance metadata", () => {
    render(<ExporterPreview pack={mockPack} />);
    expect(screen.getByText(/Engine v0.1.0/i)).toBeInTheDocument();
    expect(screen.getByText(/Rendered Oct 31, 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/abc123de.../)).toBeInTheDocument();
  });

  it("should have correct ARIA attributes for tabs", () => {
    render(<ExporterPreview pack={mockPack} />);

    const yamlTab = screen.getByRole("tab", { name: /YAML/i });
    expect(yamlTab).toHaveAttribute("aria-selected", "true");
    expect(yamlTab).toHaveAttribute("aria-controls", "preview-yaml");

    const cursorTab = screen.getByRole("tab", { name: /Cursor/i });
    expect(cursorTab).toHaveAttribute("aria-selected", "false");
  });

  it("should update ARIA attributes when switching tabs", async () => {
    const user = userEvent.setup();
    render(<ExporterPreview pack={mockPack} />);

    const cursorTab = screen.getByRole("tab", { name: /Cursor/i });
    await user.click(cursorTab);

    expect(cursorTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /YAML/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("should handle empty exporters array gracefully", () => {
    const packWithoutExporters = { ...mockPack, exporters: [] };
    render(<ExporterPreview pack={packWithoutExporters} />);
    expect(screen.getByText("No previews available")).toBeInTheDocument();
  });

  it("should map format to correct display name", () => {
    const packWithMultipleFormats: CatalogEntryExtended = {
      ...mockPack,
      exporters: [
        {
          format: "agents-md",
          preview: "# AGENTS.md",
          preview_meta: mockPack.exporters[0].preview_meta,
        },
        {
          format: "vscode-mcp",
          preview: '{"mcp": true}',
          preview_meta: mockPack.exporters[0].preview_meta,
        },
      ],
    };

    render(<ExporterPreview pack={packWithMultipleFormats} />);
    expect(screen.getByRole("tab", { name: "AGENTS.md" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "VS Code MCP" }),
    ).toBeInTheDocument();
  });
});
