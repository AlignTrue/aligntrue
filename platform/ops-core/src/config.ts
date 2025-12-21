/**
 * Phase 0 feature flag.
 * When false, new CLI commands and writes are disabled.
 * Set via OPS_CORE_ENABLED env var (default: off).
 */
export const OPS_CORE_ENABLED = process.env["OPS_CORE_ENABLED"] === "1";

/**
 * Phase 1 Milestone 1: Google Calendar connector (READ-only) kill switch.
 * Default OFF. Enables calendar ingestion + timeline projection when set.
 */
export const OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED =
  process.env["OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED"] === "1";

/**
 * Phase 1 Milestone 3: Gmail connector (READ-only) kill switch.
 * Default OFF. Enables Gmail ingestion + timeline projection when set.
 */
export const OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED =
  process.env["OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED"] === "1";

/**
 * Phase 1 Milestone 2: Contact projection kill switch.
 * Default OFF. Enables contact derivation from calendar ingest events.
 */
export const OPS_CONTACTS_ENABLED = process.env["OPS_CONTACTS_ENABLED"] === "1";
