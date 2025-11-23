/**
 * VS Code MCP transformer
 * Transforms canonical MCP config to .vscode/mcp.json format
 */

import { createMcpTransformer } from "./factory.js";

export const VscodeMcpTransformer = createMcpTransformer(".vscode/mcp.json");
