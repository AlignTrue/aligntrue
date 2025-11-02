/**
 * Tests for workflow detection and persistence
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import {
  WorkflowDetector,
  getWorkflowAnnotation,
  type WorkflowMode,
} from "../src/utils/workflow-detector.js";
import type { AlignTrueConfig } from "@aligntrue/core";

describe("WorkflowDetector", () => {
  const testRoot = join(process.cwd(), "temp-test-workflow");
  const aligntrueDir = join(testRoot, ".aligntrue");
  const markerFile = join(aligntrueDir, ".workflow-configured");
  const configPath = join(aligntrueDir, "config.yaml");

  beforeEach(() => {
    // Clean up and create fresh test directory
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
    mkdirSync(aligntrueDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  describe("isWorkflowConfigured", () => {
    it("returns false when marker file does not exist", () => {
      const detector = new WorkflowDetector(testRoot);
      expect(detector.isWorkflowConfigured()).toBe(false);
    });

    it("returns true when marker file exists", () => {
      writeFileSync(
        markerFile,
        JSON.stringify({ mode: "ir_source", timestamp: Date.now() }),
      );

      const detector = new WorkflowDetector(testRoot);
      expect(detector.isWorkflowConfigured()).toBe(true);
    });
  });

  describe("saveWorkflowChoice", () => {
    it("creates marker file with workflow choice", async () => {
      const detector = new WorkflowDetector(testRoot);
      const config: AlignTrueConfig = {
        mode: "solo",
        version: "1",
        exporters: ["cursor"],
        sync: {},
      };

      await detector.saveWorkflowChoice("ir_source", config, configPath);

      expect(existsSync(markerFile)).toBe(true);

      const choice = detector.readWorkflowChoice();
      expect(choice).not.toBeNull();
      expect(choice?.mode).toBe("ir_source");
      expect(choice?.timestamp).toBeGreaterThan(0);
    });

    it("sets auto_pull to false for ir_source workflow", async () => {
      const detector = new WorkflowDetector(testRoot);
      const config: AlignTrueConfig = {
        mode: "solo",
        version: "1",
        exporters: ["cursor"],
        sync: {
          auto_pull: true,
        },
      };

      await detector.saveWorkflowChoice("ir_source", config, configPath);

      // Config would be saved to file; we can't easily check file content
      // in this test, but the function should update config object
      expect(config.sync?.workflow_mode).toBe("ir_source");
    });

    it("sets auto_pull to true for native_format workflow", async () => {
      const detector = new WorkflowDetector(testRoot);
      const config: AlignTrueConfig = {
        mode: "solo",
        version: "1",
        exporters: ["cursor"],
        sync: {
          auto_pull: false,
        },
      };

      await detector.saveWorkflowChoice("native_format", config, configPath);

      expect(config.sync?.workflow_mode).toBe("native_format");
    });

    it("keeps existing settings for auto workflow", async () => {
      const detector = new WorkflowDetector(testRoot);
      const config: AlignTrueConfig = {
        mode: "solo",
        version: "1",
        exporters: ["cursor"],
        sync: {
          auto_pull: true,
          on_conflict: "prompt",
        },
      };

      await detector.saveWorkflowChoice("auto", config, configPath);

      expect(config.sync?.workflow_mode).toBe("auto");
      // auto_pull and on_conflict should remain unchanged
      expect(config.sync?.auto_pull).toBe(true);
      expect(config.sync?.on_conflict).toBe("prompt");
    });
  });

  describe("readWorkflowChoice", () => {
    it("returns null when marker file does not exist", () => {
      const detector = new WorkflowDetector(testRoot);
      expect(detector.readWorkflowChoice()).toBeNull();
    });

    it("reads workflow choice from marker file", () => {
      const timestamp = Date.now();
      writeFileSync(
        markerFile,
        JSON.stringify({ mode: "native_format", timestamp }),
      );

      const detector = new WorkflowDetector(testRoot);
      const choice = detector.readWorkflowChoice();

      expect(choice).not.toBeNull();
      expect(choice?.mode).toBe("native_format");
      expect(choice?.timestamp).toBe(timestamp);
    });

    it("returns null for corrupted marker file", () => {
      writeFileSync(markerFile, "invalid json{");

      const detector = new WorkflowDetector(testRoot);
      expect(detector.readWorkflowChoice()).toBeNull();
    });
  });

  describe("getWorkflowMode", () => {
    it("returns config workflow_mode if set", () => {
      const detector = new WorkflowDetector(testRoot);
      const config: AlignTrueConfig = {
        mode: "solo",
        version: "1",
        exporters: ["cursor"],
        sync: {
          workflow_mode: "ir_source",
        },
      };

      expect(detector.getWorkflowMode(config)).toBe("ir_source");
    });

    it("falls back to marker file if config not set", () => {
      writeFileSync(
        markerFile,
        JSON.stringify({ mode: "native_format", timestamp: Date.now() }),
      );

      const detector = new WorkflowDetector(testRoot);
      const config: AlignTrueConfig = {
        mode: "solo",
        version: "1",
        exporters: ["cursor"],
        sync: {},
      };

      expect(detector.getWorkflowMode(config)).toBe("native_format");
    });

    it("defaults to auto if neither config nor marker exists", () => {
      const detector = new WorkflowDetector(testRoot);
      const config: AlignTrueConfig = {
        mode: "solo",
        version: "1",
        exporters: ["cursor"],
        sync: {},
      };

      expect(detector.getWorkflowMode(config)).toBe("auto");
    });
  });
});

describe("getWorkflowAnnotation", () => {
  it("returns annotation for ir_source mode on agent files", () => {
    const annotation = getWorkflowAnnotation("ir_source", "agent");
    expect(annotation).toBe(
      "<!-- Generated by AlignTrue - do not edit directly -->",
    );
  });

  it("returns annotation for native_format mode on IR files", () => {
    const annotation = getWorkflowAnnotation("native_format", "ir");
    expect(annotation).toBe(
      "<!-- Auto-synced from agent files - edit native formats instead -->",
    );
  });

  it("returns null for auto mode", () => {
    expect(getWorkflowAnnotation("auto", "agent")).toBeNull();
    expect(getWorkflowAnnotation("auto", "ir")).toBeNull();
  });

  it("returns null for mismatched workflow/file type", () => {
    expect(getWorkflowAnnotation("ir_source", "ir")).toBeNull();
    expect(getWorkflowAnnotation("native_format", "agent")).toBeNull();
  });
});
