/**
 * Integration tests for install flow (Phase 4, Session 5)
 * Updated to test PackDetailClient component (client-side logic)
 *
 * Tests the full user journey: detail page → install button → modal → commands → download
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CatalogEntryExtended } from "@aligntrue/schema";
import { PackDetailClient } from "@/app/catalog/[slug]/PackDetailClient";

/**
 * Create test pack with full data
 */
function createFullPack(): CatalogEntryExtended {
  return {
    id: "packs/base/test-pack",
    version: "1.0.0",
    name: "Test Pack",
    slug: "test-pack",
    description: "A comprehensive test pack",
    summary_bullets: [
      "Feature 1: Code quality checks",
      "Feature 2: Security scanning",
      "Feature 3: Performance optimization",
    ],
    categories: ["code-quality", "security"],
    compatible_tools: ["cursor", "claude-code", "windsurf"],
    license: "CC0-1.0",
    maintainer: {
      name: "Test Author",
      github: "testauthor",
      email: "test@example.com",
    },
    last_updated: "2025-10-31T12:00:00Z",
    source_repo: "https://github.com/test/repo",
    source_linked: true,
    overlay_friendly: true,
    stats: {
      copies_7d: 150,
      copies_total: 1500,
    },
    has_plugs: true,
    required_plugs_count: 2,
    required_plugs: [
      {
        key: "test.cmd",
        description: "Command to run tests",
        type: "command",
        default: "pnpm test",
      },
      {
        key: "coverage.threshold",
        description: "Minimum coverage percentage",
        type: "text",
      },
    ],
    rules_index: [
      {
        id: "rule-1",
        content_sha: "abc123",
      },
    ],
    exporters: [
      {
        format: "yaml",
        preview: 'spec_version: "1"\nprofile:\n  id: test-pack',
        preview_meta: {
          engine_version: "0.1.0",
          canonical_yaml_sha: "xyz789",
          rendered_at: "2025-10-31T12:00:00Z",
        },
      },
      {
        format: "cursor",
        preview: "# Test Pack Rules\n\nCode quality and security guidance.",
        preview_meta: {
          engine_version: "0.1.0",
          canonical_yaml_sha: "xyz789",
          rendered_at: "2025-10-31T12:00:00Z",
        },
      },
    ],
  };
}

describe("Install Flow Integration", () => {
  let originalClipboard: typeof navigator.clipboard;
  const mockPack = createFullPack();
  const mockAllPacks = [mockPack];

  beforeEach(() => {
    // Add portal root BEFORE setting up any mocks
    const portalRoot = document.createElement("div");
    portalRoot.id = "__next";
    document.body.appendChild(portalRoot);

    // Mock clipboard API
    originalClipboard = navigator.clipboard;
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock download helpers
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(document.body, "appendChild");
    vi.spyOn(document.body, "removeChild");

    // Mock window.location for structured data JSON-LD
    Object.defineProperty(window, "location", {
      value: { origin: "https://aligntrue.ai" },
      writable: true,
    });
  });

  afterEach(() => {
    Object.assign(navigator, { clipboard: originalClipboard });
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("completes full install flow from button to modal", async () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Test Pack")).toBeInTheDocument();

    // Click install button
    const installButton = screen.getByText("Install with AlignTrue");
    fireEvent.click(installButton);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText("Install Test Pack")).toBeInTheDocument();
    });

    // Should show all installation steps
    expect(screen.getByText("Install AlignTrue CLI")).toBeInTheDocument();
    expect(screen.getByText("Add pack")).toBeInTheDocument();
    expect(screen.getByText("Configure test.cmd")).toBeInTheDocument();
    expect(
      screen.getByText("Configure coverage.threshold"),
    ).toBeInTheDocument();
  });

  it("copies commands from modal", async () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Test Pack")).toBeInTheDocument();

    // Open modal
    fireEvent.click(screen.getByText("Install with AlignTrue"));

    await waitFor(() => {
      expect(screen.getByText("Install Test Pack")).toBeInTheDocument();
    });

    // Copy first command - use specific aria-label to avoid clicking exporter preview copy button
    const copyButton = screen.getByRole("button", {
      name: /Copy Install AlignTrue CLI command/i,
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("curl -fsSL"),
      );
    });

    // Copy all commands
    const copyAllButton = screen.getByText("Copy all commands");
    fireEvent.click(copyAllButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("# Install AlignTrue CLI"),
      );
    });
  });

  it("downloads YAML from modal", async () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Test Pack")).toBeInTheDocument();

    // Open modal
    fireEvent.click(screen.getByText("Install with AlignTrue"));

    await waitFor(() => {
      expect(screen.getByText("Install Test Pack")).toBeInTheDocument();
    });

    // Download YAML
    const downloadButton = screen.getByText("Download YAML");
    fireEvent.click(downloadButton);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalled();
  });

  it("closes modal with ESC key", async () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Test Pack")).toBeInTheDocument();

    // Open modal
    fireEvent.click(screen.getByText("Install with AlignTrue"));

    await waitFor(() => {
      expect(screen.getByText("Install Test Pack")).toBeInTheDocument();
    });

    // Close with ESC
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Install Test Pack")).not.toBeInTheDocument();
    });
  });

  it("closes modal with close button", async () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Test Pack")).toBeInTheDocument();

    // Open modal
    fireEvent.click(screen.getByText("Install with AlignTrue"));

    await waitFor(() => {
      expect(screen.getByText("Install Test Pack")).toBeInTheDocument();
    });

    // Close with button
    const closeButton = screen.getByLabelText("Close modal");
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText("Install Test Pack")).not.toBeInTheDocument();
    });
  });

  it("generates correct plug commands with defaults", async () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Test Pack")).toBeInTheDocument();

    // Open modal
    fireEvent.click(screen.getByText("Install with AlignTrue"));

    await waitFor(() => {
      expect(screen.getByText("Install Test Pack")).toBeInTheDocument();
    });

    // Check plug commands - use getAllByText since they appear multiple times
    const testCmdMatches = screen.getAllByText(
      /aln plugs set test\.cmd "pnpm test"/,
    );
    expect(testCmdMatches.length).toBeGreaterThan(0);
    const coverageMatches = screen.getAllByText(
      /aln plugs set coverage\.threshold "<coverage\.threshold>"/,
    );
    expect(coverageMatches.length).toBeGreaterThan(0);
  });

  it("displays tracking transparency note", async () => {
    render(<PackDetailClient pack={mockPack} allPacks={mockAllPacks} />);

    expect(screen.getByText("Test Pack")).toBeInTheDocument();

    // Open modal
    fireEvent.click(screen.getByText("Install with AlignTrue"));

    await waitFor(() => {
      expect(screen.getByText("Install Test Pack")).toBeInTheDocument();
    });

    // Check transparency note - use getAllByText since --from appears multiple times
    const matches = screen.getAllByText(/--from=catalog_web/);
    expect(matches.length).toBeGreaterThan(0);
    expect(
      screen.getByText(/This is transparent tracking/),
    ).toBeInTheDocument();
  });
});
