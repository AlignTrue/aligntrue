/**
 * MCP propagation tests
 * Validates that MCP server configurations are correctly propagated
 * from centralized config to agent-specific formats
 */

import { describe, it, expect } from "vitest";
import { generateCanonicalMcpConfig, type McpServer } from "@aligntrue/core";
import {
  VscodeMcpTransformer,
  CursorMcpTransformer,
  RootMcpTransformer,
  WindsurfMcpTransformer,
} from "../src/mcp-transformers/index.js";

describe("MCP server configuration propagation", () => {
  describe("Canonical MCP config generation", () => {
    it("generates empty config when no servers provided", () => {
      const config = generateCanonicalMcpConfig([]);

      expect(config.version).toBe("v1");
      expect(config.generated_by).toBe("AlignTrue");
      expect(config.mcpServers).toBeUndefined();
      expect(config.content_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("includes servers in config when provided", () => {
      const servers: McpServer[] = [
        {
          name: "custom-tool",
          command: "python",
          args: ["./mcp.py"],
        },
      ];

      const config = generateCanonicalMcpConfig(servers);

      expect(config.mcpServers).toBeDefined();
      expect(config.mcpServers?.["custom-tool"]).toEqual({
        command: "python",
        args: ["./mcp.py"],
      });
    });

    it("skips disabled servers", () => {
      const servers: McpServer[] = [
        {
          name: "enabled",
          command: "node",
          args: ["./server.js"],
        },
        {
          name: "disabled",
          command: "python",
          args: ["./mcp.py"],
          disabled: true,
        },
      ];

      const config = generateCanonicalMcpConfig(servers);

      expect(config.mcpServers?.["enabled"]).toBeDefined();
      expect(config.mcpServers?.["disabled"]).toBeUndefined();
    });

    it("includes environment variables when present", () => {
      const servers: McpServer[] = [
        {
          name: "app-server",
          command: "node",
          args: ["./server.js"],
          env: {
            API_KEY: "secret",
            DEBUG: "true",
          },
        },
      ];

      const config = generateCanonicalMcpConfig(servers);

      expect(config.mcpServers?.["app-server"]?.env).toEqual({
        API_KEY: "secret",
        DEBUG: "true",
      });
    });

    it("produces deterministic hash from servers", () => {
      const servers: McpServer[] = [
        {
          name: "test",
          command: "node",
          args: ["./test.js"],
        },
      ];

      const config1 = generateCanonicalMcpConfig(servers);
      const config2 = generateCanonicalMcpConfig(servers);

      expect(config1.content_hash).toBe(config2.content_hash);
    });

    it("produces different hash for different servers", () => {
      const servers1: McpServer[] = [{ name: "test", command: "node" }];
      const servers2: McpServer[] = [{ name: "test", command: "python" }];

      const config1 = generateCanonicalMcpConfig(servers1);
      const config2 = generateCanonicalMcpConfig(servers2);

      expect(config1.content_hash).not.toBe(config2.content_hash);
    });

    it("sorts servers alphabetically for determinism", () => {
      const servers: McpServer[] = [
        { name: "zebra", command: "node" },
        { name: "alpha", command: "python" },
        { name: "beta", command: "ruby" },
      ];

      const config = generateCanonicalMcpConfig(servers);

      // Hash should be the same regardless of input order
      const serversReordered: McpServer[] = [
        { name: "alpha", command: "python" },
        { name: "beta", command: "ruby" },
        { name: "zebra", command: "node" },
      ];

      const configReordered = generateCanonicalMcpConfig(serversReordered);

      expect(config.content_hash).toBe(configReordered.content_hash);
    });
  });

  describe("VS Code MCP transformer", () => {
    it("transforms to VS Code format", () => {
      const servers: McpServer[] = [
        {
          name: "my-tool",
          command: "node",
          args: ["./tool.js"],
        },
      ];

      const config = generateCanonicalMcpConfig(servers);
      const transformer = new VscodeMcpTransformer();
      const output = transformer.transform(config);
      const parsed = JSON.parse(output);

      expect(parsed.servers).toBeDefined();
      expect(parsed.servers["my-tool"]).toEqual({
        command: "node",
        args: ["./tool.js"],
      });
    });

    it("outputs to .vscode/mcp.json", () => {
      const transformer = new VscodeMcpTransformer();
      const path = transformer.getOutputPath("/project");

      expect(path).toMatch(/\.vscode[/\\]mcp\.json$/);
    });
  });

  describe("Cursor MCP transformer", () => {
    it("transforms to Cursor format", () => {
      const servers: McpServer[] = [
        {
          name: "analyzer",
          command: "python",
          args: ["./analyzer.py"],
        },
      ];

      const config = generateCanonicalMcpConfig(servers);
      const transformer = new CursorMcpTransformer();
      const output = transformer.transform(config);
      const parsed = JSON.parse(output);

      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers["analyzer"]).toEqual({
        command: "python",
        args: ["./analyzer.py"],
      });
    });

    it("outputs to .cursor/mcp.json", () => {
      const transformer = new CursorMcpTransformer();
      const path = transformer.getOutputPath("/project");

      expect(path).toMatch(/\.cursor[/\\]mcp\.json$/);
    });
  });

  describe("Root MCP transformer", () => {
    it("transforms to root format for Claude/Aider", () => {
      const servers: McpServer[] = [
        {
          name: "claude-server",
          command: "npx",
          args: ["-y", "@anthropic-ai/claude-server"],
        },
      ];

      const config = generateCanonicalMcpConfig(servers);
      const transformer = new RootMcpTransformer();
      const output = transformer.transform(config);
      const parsed = JSON.parse(output);

      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers["claude-server"]).toEqual({
        command: "npx",
        args: ["-y", "@anthropic-ai/claude-server"],
      });
    });

    it("outputs to .mcp.json at root", () => {
      const transformer = new RootMcpTransformer();
      const path = transformer.getOutputPath("/project");

      // Root-level MCP config goes directly in the project directory
      expect(path).toMatch(/\.mcp\.json$/);
      expect(path).toContain("/project/");
    });
  });

  describe("Windsurf MCP transformer", () => {
    it("transforms to Windsurf format", () => {
      const servers: McpServer[] = [
        {
          name: "windsurf-ai",
          command: "node",
          args: ["./windsurf-ai.js"],
        },
      ];

      const config = generateCanonicalMcpConfig(servers);
      const transformer = new WindsurfMcpTransformer();
      const output = transformer.transform(config);
      const parsed = JSON.parse(output);

      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers["windsurf-ai"]).toEqual({
        command: "node",
        args: ["./windsurf-ai.js"],
      });
    });

    it("outputs to .windsurf/mcp_config.json", () => {
      const transformer = new WindsurfMcpTransformer();
      const path = transformer.getOutputPath("/project");

      expect(path).toMatch(/\.windsurf[/\\]mcp_config\.json$/);
    });
  });

  describe("Complex scenarios", () => {
    it("handles multiple servers with environment variables", () => {
      const servers: McpServer[] = [
        {
          name: "api-client",
          command: "node",
          args: ["./api-client.js"],
          env: {
            API_TOKEN: "secret123",
            DEBUG: "false",
          },
        },
        {
          name: "database-proxy",
          command: "python",
          args: ["./db.py", "--port", "3306"],
          env: {
            DB_HOST: "localhost",
          },
        },
        {
          name: "disabled-server",
          command: "ruby",
          disabled: true,
        },
      ];

      const config = generateCanonicalMcpConfig(servers);

      expect(config.mcpServers).toBeDefined();
      expect(Object.keys(config.mcpServers || {})).toHaveLength(2);
      expect(config.mcpServers?.["api-client"]?.env?.API_TOKEN).toBe(
        "secret123",
      );
      expect(
        config.mcpServers?.["database-proxy"]?.args?.includes("--port"),
      ).toBe(true);
      expect(config.mcpServers?.["disabled-server"]).toBeUndefined();
    });

    it("outputs valid JSON for all transformers", () => {
      const servers: McpServer[] = [
        {
          name: "test-server",
          command: "node",
          args: ["./test.js"],
        },
      ];

      const config = generateCanonicalMcpConfig(servers);

      const transformers = [
        new VscodeMcpTransformer(),
        new CursorMcpTransformer(),
        new RootMcpTransformer(),
        new WindsurfMcpTransformer(),
      ];

      for (const transformer of transformers) {
        const output = transformer.transform(config);

        // Should be valid JSON
        expect(() => JSON.parse(output)).not.toThrow();

        // Should have trailing newline
        expect(output.endsWith("\n")).toBe(true);
      }
    });
  });
});
