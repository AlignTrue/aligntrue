const bool = (key: string, fallback = false): boolean =>
  process.env[key] === "1" ? true : fallback;

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const OPS_CORE_ENABLED = bool("OPS_CORE_ENABLED");
export const OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED = bool(
  "OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED",
);
export const OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED = bool(
  "OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED",
);
export const OPS_CONTACTS_ENABLED = bool("OPS_CONTACTS_ENABLED");
export const OPS_HYBRID_EXEC_ENABLED = bool("OPS_HYBRID_EXEC_ENABLED");
export const OPS_MODEL_EGRESS_ENABLED = bool("OPS_MODEL_EGRESS_ENABLED");

export const OPS_MODEL_MAX_CALLS_PER_RUN = num(
  "OPS_MODEL_MAX_CALLS_PER_RUN",
  10,
);
export const OPS_MODEL_MAX_CALLS_PER_DAY = num(
  "OPS_MODEL_MAX_CALLS_PER_DAY",
  1000,
);
export const OPS_MODEL_MAX_TOKENS_PER_RUN = num(
  "OPS_MODEL_MAX_TOKENS_PER_RUN",
  50000,
);
export const OPS_MODEL_MAX_TOKENS_PER_DAY = num(
  "OPS_MODEL_MAX_TOKENS_PER_DAY",
  500000,
);
export const OPS_MODEL_MIN_INTERVAL_MS = num("OPS_MODEL_MIN_INTERVAL_MS", 100);

export const OPS_SUGGESTIONS_ENABLED = bool("OPS_SUGGESTIONS_ENABLED");
export const OPS_PLANS_DAILY_ENABLED = bool("OPS_PLANS_DAILY_ENABLED");
export const OPS_GMAIL_MUTATIONS_ENABLED = bool("OPS_GMAIL_MUTATIONS_ENABLED");
export const OPS_GMAIL_SEND_ENABLED = bool("OPS_GMAIL_SEND_ENABLED");
export const OPS_TASKS_ENABLED = bool("OPS_TASKS_ENABLED");
export const OPS_NOTES_ENABLED = bool("OPS_NOTES_ENABLED");
export const OPS_TRAJECTORIES_ENABLED = bool("OPS_TRAJECTORIES_ENABLED");
export const OPS_MEMORY_PROVIDER_ENABLED = bool("OPS_MEMORY_PROVIDER_ENABLED");
export const OPS_PLANS_WEEKLY_ENABLED = bool("OPS_PLANS_WEEKLY_ENABLED");

export const OPS_WEEKLY_PLAN_MAX_PER_WEEK = num(
  "OPS_WEEKLY_PLAN_MAX_PER_WEEK",
  3,
);
export const OPS_WEEKLY_PLAN_MIN_HOURS = num("OPS_WEEKLY_PLAN_MIN_HOURS", 24);

export const OPS_EMAIL_STATUS_ENABLED = bool("OPS_EMAIL_STATUS_ENABLED");
export const OPS_EMAIL_AUTO_COMMIT_ENABLED = bool(
  "OPS_EMAIL_AUTO_COMMIT_ENABLED",
);

export const OPS_AI_BASE_URL =
  process.env["OPS_AI_BASE_URL"] ?? "http://localhost:1234/v1";
export const OPS_AI_MODEL = process.env["OPS_AI_MODEL"] ?? "local-model";
export const OPS_AI_API_KEY = process.env["OPS_AI_API_KEY"] ?? "lm-studio";

export const OPS_AI_PROVIDER = process.env["OPS_AI_PROVIDER"] ?? "openai";
export const OPS_CALENDAR_PROVIDER =
  process.env["OPS_CALENDAR_PROVIDER"] ?? "google_calendar";
export const OPS_EMAIL_PROVIDER =
  process.env["OPS_EMAIL_PROVIDER"] ?? "google_gmail";

export const OPS_DATA_DIR = process.env["OPS_DATA_DIR"] ?? "./data";
