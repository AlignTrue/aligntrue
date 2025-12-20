/**
 * Phase 0 feature flag.
 * When false, new CLI commands and writes are disabled.
 * Set via OPS_CORE_ENABLED env var (default: off).
 */
export const OPS_CORE_ENABLED = process.env["OPS_CORE_ENABLED"] === "1";
