/**
 * Types for plugs resolution
 */

/**
 * Resolution result for a single placeholder
 */
export interface PlugResolution {
  key: string;
  resolved: boolean;
  value?: string | undefined; // Resolved value (if filled)
  todo?: string | undefined; // TODO block (if unresolved and required)
}

/**
 * Result of resolving plugs in text
 */
export interface ResolveTextResult {
  text: string; // Resolved text with LF normalization
  resolutions: PlugResolution[]; // Details for each placeholder
  unresolvedRequired: string[]; // Keys of unresolved required plugs
}

/**
 * Result of resolving plugs for an entire align
 */
export interface ResolvePackResult {
  success: boolean;
  rules: Array<{
    ruleId: string;
    content?: string; // Resolved content text
    resolutions: PlugResolution[];
  }>;
  unresolvedRequired: string[];
  errors?: string[];
}

/**
 * Options for plug resolution
 */
export interface ResolveOptions {
  failOnUnresolved?: boolean; // Fail if any required plug is unresolved (for --strict mode)
}

/**
 * Error thrown during plug resolution
 */
export class PlugResolutionError extends Error {
  constructor(
    message: string,
    public readonly key?: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = "PlugResolutionError";
  }
}
