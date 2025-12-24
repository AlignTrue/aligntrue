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

/**
 * Phase 1 Milestone 4: Hybrid execution spine (runs + router + budgets).
 * Default OFF. Enables run/step runtime and CLI.
 */
export const OPS_HYBRID_EXEC_ENABLED =
  process.env["OPS_HYBRID_EXEC_ENABLED"] === "1";

/**
 * Model egress gateway kill switch for hybrid execution.
 * Default OFF. When disabled, model calls are blocked even if router allows.
 */
export const OPS_MODEL_EGRESS_ENABLED =
  process.env["OPS_MODEL_EGRESS_ENABLED"] === "1";

/**
 * Budget knobs for model gateway (conservative defaults, process-local counters).
 */
export const OPS_MODEL_MAX_CALLS_PER_RUN = Number.parseInt(
  process.env["OPS_MODEL_MAX_CALLS_PER_RUN"] ?? "10",
);
export const OPS_MODEL_MAX_CALLS_PER_DAY = Number.parseInt(
  process.env["OPS_MODEL_MAX_CALLS_PER_DAY"] ?? "1000",
);
export const OPS_MODEL_MAX_TOKENS_PER_RUN = Number.parseInt(
  process.env["OPS_MODEL_MAX_TOKENS_PER_RUN"] ?? "50000",
);
export const OPS_MODEL_MAX_TOKENS_PER_DAY = Number.parseInt(
  process.env["OPS_MODEL_MAX_TOKENS_PER_DAY"] ?? "500000",
);
export const OPS_MODEL_MIN_INTERVAL_MS = Number.parseInt(
  process.env["OPS_MODEL_MIN_INTERVAL_MS"] ?? "100",
);

/**
 * Phase 1 Milestone 7: Suggestions + Daily Plans kill switches.
 * Default OFF. Enables suggestion generation/approval and daily plan artifacts.
 */
export const OPS_SUGGESTIONS_ENABLED =
  process.env["OPS_SUGGESTIONS_ENABLED"] === "1";
export const OPS_PLANS_DAILY_ENABLED =
  process.env["OPS_PLANS_DAILY_ENABLED"] === "1";

/**
 * Phase 1 Milestone 6: Gmail label/archive mutations kill switch.
 * Default OFF. Enables Gmail mutation execution when set.
 */
export const OPS_GMAIL_MUTATIONS_ENABLED =
  process.env["OPS_GMAIL_MUTATIONS_ENABLED"] === "1";
/**
 * Gmail send/draft kill switch.
 * Default OFF. Enables Gmail send when set.
 */
export const OPS_GMAIL_SEND_ENABLED =
  process.env["OPS_GMAIL_SEND_ENABLED"] === "1";

/**
 * Phase 1 Milestone 5: Tasks and Notes kill switches.
 * Default OFF. Enables task/note commands, projections, and UI surfaces when set.
 */
export const OPS_TASKS_ENABLED = process.env["OPS_TASKS_ENABLED"] === "1";
export const OPS_NOTES_ENABLED = process.env["OPS_NOTES_ENABLED"] === "1";

/**
 * Phase 1 Milestone 8: Memory provider + Weekly Plan kill switches.
 * Default OFF. Enables memory provider usage and weekly plan generation.
 */
export const OPS_MEMORY_PROVIDER_ENABLED =
  process.env["OPS_MEMORY_PROVIDER_ENABLED"] === "1";
export const OPS_PLANS_WEEKLY_ENABLED =
  process.env["OPS_PLANS_WEEKLY_ENABLED"] === "1";

/**
 * Weekly plan budget knobs (conservative defaults).
 */
export const OPS_WEEKLY_PLAN_MAX_PER_WEEK = Number.parseInt(
  process.env["OPS_WEEKLY_PLAN_MAX_PER_WEEK"] ?? "3",
);
export const OPS_WEEKLY_PLAN_MIN_HOURS = Number.parseInt(
  process.env["OPS_WEEKLY_PLAN_MIN_HOURS"] ?? "24",
);

/**
 * Email workflow + AI config
 */
export const OPS_EMAIL_STATUS_ENABLED =
  process.env["OPS_EMAIL_STATUS_ENABLED"] === "1";
export const OPS_EMAIL_AUTO_COMMIT_ENABLED =
  process.env["OPS_EMAIL_AUTO_COMMIT_ENABLED"] === "1";

export const OPS_AI_BASE_URL =
  process.env["OPS_AI_BASE_URL"] ?? "http://localhost:1234/v1";
export const OPS_AI_MODEL = process.env["OPS_AI_MODEL"] ?? "local-model";
export const OPS_AI_API_KEY = process.env["OPS_AI_API_KEY"] ?? "lm-studio";

/**
 * Provider selection (defaults preserve existing behavior).
 */
export const OPS_AI_PROVIDER = process.env["OPS_AI_PROVIDER"] ?? "openai";
export const OPS_CALENDAR_PROVIDER =
  process.env["OPS_CALENDAR_PROVIDER"] ?? "google_calendar";
export const OPS_EMAIL_PROVIDER =
  process.env["OPS_EMAIL_PROVIDER"] ?? "google_gmail";

/**
 * Base directory for ops-core JSONL storage.
 * Defaults to ./data (relative to process CWD) but should be set explicitly
 * in serverless or multi-process environments (e.g., OPS_DATA_DIR=/tmp/aligntrue).
 */
export const OPS_DATA_DIR = process.env["OPS_DATA_DIR"] ?? "./data";
