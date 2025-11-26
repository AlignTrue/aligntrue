/**
 * Base MCP transformer
 * Abstract base class for client-specific MCP format transformations
 */

import type { CanonicalMcpConfig } from "@aligntrue/core";

/**
 * Base class for MCP format transformers
 * Each client-specific transformer implements the transform method
 */
export abstract class BaseMcpTransformer {
  /**
   * Transform canonical MCP config to client-specific format
   * Returns the transformed content as a string
   */
  abstract transform(config: CanonicalMcpConfig): string;

  /**
   * Get the output file path for this client
   * Default: uses relative path passed at construction
   */
  abstract getOutputPath(baseDir: string): string;

  /**
   * Format JSON with standard options (2-space indent, trailing newline)
   */
  formatJson(obj: unknown): string {
    return JSON.stringify(obj, null, 2) + "\n";
  }
}
