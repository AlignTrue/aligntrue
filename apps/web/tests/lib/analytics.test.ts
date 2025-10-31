/**
 * Tests for analytics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  trackCatalogSearch,
  trackCatalogFilter,
  trackDetailView,
  trackExporterTabSwitch,
  trackCopyInstallCommand,
  trackCopyExporterPreview,
  trackShareLinkCopy,
  optOutAnalytics,
  optInAnalytics,
} from "@/lib/analytics";

describe("Analytics", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let localStorageGetSpy: ReturnType<typeof vi.spyOn>;
  let localStorageSetSpy: ReturnType<typeof vi.spyOn>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Save and set NODE_ENV to development for analytics logging
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    // Mock console.log
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock localStorage
    const storage: Record<string, string> = {};
    localStorageGetSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation((key) => storage[key] || null);
    localStorageSetSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation((key, value) => {
        storage[key] = value;
      });

    // Mock navigator.doNotTrack
    Object.defineProperty(navigator, "doNotTrack", {
      value: "0",
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    consoleLogSpy.mockRestore();
    localStorageGetSpy.mockRestore();
    localStorageSetSpy.mockRestore();
  });

  describe("Event tracking", () => {
    it("should track catalog search with query and result count", () => {
      trackCatalogSearch("typescript", 15);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Analytics]",
        expect.objectContaining({
          type: "catalog_search",
          query: "typescript",
          resultCount: 15,
          timestamp: expect.any(String),
          sessionId: expect.any(String),
        }),
      );
    });

    it("should track catalog filter application", () => {
      trackCatalogFilter("status", "active");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Analytics]",
        expect.objectContaining({
          type: "catalog_filter",
          filterType: "status",
          value: "active",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should track pack detail view", () => {
      trackDetailView("base-global", "1.0.0");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Analytics]",
        expect.objectContaining({
          type: "detail_view",
          packSlug: "base-global",
          version: "1.0.0",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should track exporter tab switch", () => {
      trackExporterTabSwitch("base-global", "cursor", "yaml");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Analytics]",
        expect.objectContaining({
          type: "exporter_tab_switch",
          packSlug: "base-global",
          fromFormat: "yaml",
          toFormat: "cursor",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should track install command copy with from flag", () => {
      trackCopyInstallCommand("base-global", true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Analytics]",
        expect.objectContaining({
          type: "copy_install_command",
          packSlug: "base-global",
          includesFromFlag: true,
          timestamp: expect.any(String),
        }),
      );
    });

    it("should track exporter preview copy", () => {
      trackCopyExporterPreview("base-global", "cursor");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Analytics]",
        expect.objectContaining({
          type: "copy_exporter_preview",
          packSlug: "base-global",
          format: "cursor",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should track share link copy with URL", () => {
      const url = "https://aligntrue.ai/catalog/base-global?utm_source=share";
      trackShareLinkCopy("base-global", url);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Analytics]",
        expect.objectContaining({
          type: "share_link_copy",
          packSlug: "base-global",
          url,
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe("Privacy controls", () => {
    it("should respect Do Not Track header", () => {
      Object.defineProperty(navigator, "doNotTrack", {
        value: "1",
        writable: true,
        configurable: true,
      });

      trackCatalogSearch("test", 0);

      // Should not log when DNT is enabled
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should respect opt-out preference", () => {
      localStorageSetSpy("aligntrue_analytics", "disabled");
      localStorageGetSpy.mockReturnValue("disabled");

      trackCatalogSearch("test", 0);

      // Should not log when opted out
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should allow opt-out", () => {
      optOutAnalytics();

      expect(localStorageSetSpy).toHaveBeenCalledWith(
        "aligntrue_analytics",
        "disabled",
      );
    });

    it("should allow opt-in", () => {
      optInAnalytics();

      expect(localStorageSetSpy).toHaveBeenCalledWith(
        "aligntrue_analytics",
        "enabled",
      );
    });
  });

  describe("Event payload structure", () => {
    it("should include timestamp in ISO format", () => {
      trackCatalogSearch("test", 0);

      const call = consoleLogSpy.mock.calls[0];
      const event = call[1];

      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should include session ID", () => {
      trackCatalogSearch("test1", 0);
      trackCatalogSearch("test2", 0);

      const call1 = consoleLogSpy.mock.calls[0];
      const call2 = consoleLogSpy.mock.calls[1];

      // Same session ID across events
      expect(call1[1].sessionId).toBe(call2[1].sessionId);
      expect(call1[1].sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);
    });
  });
});
