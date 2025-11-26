/**
 * MCP synchronization integration tests
 * Tests that MCP server configurations sync correctly from config to agent files
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { ExporterRegistry } from "@aligntrue/exporters";
import type { AlignTrueConfig } from "@aligntrue/core";

const TEST_DIR = join(import.meta.dirname, "temp-mcp-sync-test");

describe("MCP synchronization", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("MCP server propagation", () => {
    it("writes .vscode/mcp.json from config when vscode-mcp exporter enabled", async () => {
      const config: AlignTrueConfig = {
        version: "1",
        mode: "solo",
        profile: { id: "test" },
        exporters: ["vscode-mcp"],
        mcp: {
          servers: [
            {
              name: "test-server",
              command: "node",
              args: ["./server.js"],
            },
          ],
        },
      };

      const registry = new ExporterRegistry();

      // Mock basic align structure
      const align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };

      const options = {
        outputDir: TEST_DIR,
        dryRun: false,
        config,
      };

      // Get VS Code MCP exporter and run it
      const exporter = registry.getExporter("vscode-mcp");
      const request = {
        scope: { path: ".", includeGlobs: [], excludeGlobs: [] },
        rules: [],
        align,
        outputPath: join(TEST_DIR, ".vscode", "mcp.json"),
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBeGreaterThan(0);

      // Verify file was written
      const mcpPath = join(TEST_DIR, ".vscode", "mcp.json");
      expect(existsSync(mcpPath)).toBe(true);

      // Verify content
      const content = JSON.parse(readFileSync(mcpPath, "utf8"));
      expect(content.servers).toBeDefined();
      expect(content.servers["test-server"]).toEqual({
        command: "node",
        args: ["./server.js"],
      });
    });

    it("writes .cursor/mcp.json from config when cursor-mcp exporter enabled", async () => {
      const config: AlignTrueConfig = {
        version: "1",
        mode: "solo",
        profile: { id: "test" },
        exporters: ["cursor-mcp"],
        mcp: {
          servers: [
            {
              name: "cursor-server",
              command: "python",
              args: ["./server.py"],
            },
          ],
        },
      };

      const registry = new ExporterRegistry();
      const align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };

      const options = {
        outputDir: TEST_DIR,
        dryRun: false,
        config,
      };

      const exporter = registry.getExporter("cursor-mcp");
      const request = {
        scope: { path: ".", includeGlobs: [], excludeGlobs: [] },
        rules: [],
        align,
        outputPath: join(TEST_DIR, ".cursor", "mcp.json"),
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);

      const mcpPath = join(TEST_DIR, ".cursor", "mcp.json");
      expect(existsSync(mcpPath)).toBe(true);

      const content = JSON.parse(readFileSync(mcpPath, "utf8"));
      expect(content.mcpServers).toBeDefined();
      expect(content.mcpServers["cursor-server"]).toEqual({
        command: "python",
        args: ["./server.py"],
      });
    });

    it("excludes disabled servers from output", async () => {
      const config: AlignTrueConfig = {
        version: "1",
        mode: "solo",
        profile: { id: "test" },
        exporters: ["vscode-mcp"],
        mcp: {
          servers: [
            {
              name: "enabled",
              command: "node",
              args: ["./enabled.js"],
            },
            {
              name: "disabled",
              command: "python",
              args: ["./disabled.py"],
              disabled: true,
            },
          ],
        },
      };

      const registry = new ExporterRegistry();
      const align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };

      const options = {
        outputDir: TEST_DIR,
        dryRun: false,
        config,
      };

      const exporter = registry.getExporter("vscode-mcp");
      const request = {
        scope: { path: ".", includeGlobs: [], excludeGlobs: [] },
        rules: [],
        align,
        outputPath: join(TEST_DIR, ".vscode", "mcp.json"),
      };

      await exporter.export(request, options);

      const mcpPath = join(TEST_DIR, ".vscode", "mcp.json");
      const content = JSON.parse(readFileSync(mcpPath, "utf8"));

      expect(content.servers?.["enabled"]).toBeDefined();
      expect(content.servers?.["disabled"]).toBeUndefined();
    });

    it("returns empty result when no servers configured", async () => {
      const config: AlignTrueConfig = {
        version: "1",
        mode: "solo",
        profile: { id: "test" },
        exporters: ["vscode-mcp"],
        // No mcp.servers
      };

      const registry = new ExporterRegistry();
      const align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };

      const options = {
        outputDir: TEST_DIR,
        dryRun: false,
        config,
      };

      const exporter = registry.getExporter("vscode-mcp");
      const request = {
        scope: { path: ".", includeGlobs: [], excludeGlobs: [] },
        rules: [],
        align,
        outputPath: join(TEST_DIR, ".vscode", "mcp.json"),
      };

      const result = await exporter.export(request, options);

      expect(result.success).toBe(true);
      expect(result.filesWritten.length).toBe(0);
      expect(result.contentHash).toBe("");
    });

    it("includes environment variables in output", async () => {
      const config: AlignTrueConfig = {
        version: "1",
        mode: "solo",
        profile: { id: "test" },
        exporters: ["root-mcp"],
        mcp: {
          servers: [
            {
              name: "api-server",
              command: "node",
              args: ["./api.js"],
              env: {
                API_KEY: "secret",
                DEBUG: "true",
              },
            },
          ],
        },
      };

      const registry = new ExporterRegistry();
      const align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };

      const options = {
        outputDir: TEST_DIR,
        dryRun: false,
        config,
      };

      const exporter = registry.getExporter("root-mcp");
      const request = {
        scope: { path: ".", includeGlobs: [], excludeGlobs: [] },
        rules: [],
        align,
        outputPath: join(TEST_DIR, ".mcp.json"),
      };

      await exporter.export(request, options);

      const mcpPath = join(TEST_DIR, ".mcp.json");
      const content = JSON.parse(readFileSync(mcpPath, "utf8"));

      expect(content.mcpServers["api-server"].env).toEqual({
        API_KEY: "secret",
        DEBUG: "true",
      });
    });

    it("produces deterministic content hash", async () => {
      const config: AlignTrueConfig = {
        version: "1",
        mode: "solo",
        profile: { id: "test" },
        exporters: ["vscode-mcp"],
        mcp: {
          servers: [
            {
              name: "test",
              command: "node",
              args: ["./test.js"],
            },
          ],
        },
      };

      const registry = new ExporterRegistry();
      const align = {
        id: "test",
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };

      const options = {
        outputDir: TEST_DIR,
        dryRun: false,
        config,
      };

      const exporter = registry.getExporter("vscode-mcp");
      const request1 = {
        scope: { path: ".", includeGlobs: [], excludeGlobs: [] },
        rules: [],
        align,
        outputPath: join(TEST_DIR, ".vscode", "mcp.json"),
      };

      const result1 = await exporter.export(request1, options);

      exporter.resetState();

      const request2 = {
        scope: { path: ".", includeGlobs: [], excludeGlobs: [] },
        rules: [],
        align,
        outputPath: join(TEST_DIR, ".vscode", "mcp.json"),
      };

      const result2 = await exporter.export(request2, options);

      expect(result1.contentHash).toBe(result2.contentHash);
      expect(result1.contentHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
