/**
 * Cursor MCP transformer
 * Transforms canonical MCP config to .cursor/mcp.json format
 */

import { createMcpTransformer } from "./factory.js";

export const CursorMcpTransformer = createMcpTransformer(".cursor/mcp.json");
