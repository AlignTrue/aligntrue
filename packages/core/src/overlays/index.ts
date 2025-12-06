/**
 * Overlays module for Fork-Safe Customization (Overlays system)
 * Enables declarative customization of upstream rules without forking
 *
 * Configuration format in .aligntrue/config.yaml:
 *
 * overlays:
 *   overrides:
 *     - selector: "sections[0]"
 *       set:
 *         priority: "high"
 *
 * Testing gotcha: Manual YAML edits must match this exact structure.
 * Recommended approach: Use 'aligntrue override add' CLI command which
 * ensures correct format and validates selectors before persisting.
 */

export * from "./types.js";
export * from "./selector-parser.js";
export * from "./selector-engine.js";
export * from "./operations.js";
export * from "./apply.js";
export * from "./validation.js";
