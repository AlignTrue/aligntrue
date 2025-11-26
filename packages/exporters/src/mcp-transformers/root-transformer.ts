/**
 * Root MCP transformer
 * Transforms canonical MCP config to .mcp.json format (root level)
 * Used by Claude Code, Aider, and other agents
 */

import { createMcpTransformer } from "./factory.js";

export const RootMcpTransformer = createMcpTransformer({
  path: ".mcp.json",
  format: "generic",
});
