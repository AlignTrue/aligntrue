// Public API surface for ops-core
export {
  OPS_CONTACTS_ENABLED,
  OPS_CORE_ENABLED,
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  OPS_HYBRID_EXEC_ENABLED,
  OPS_MODEL_EGRESS_ENABLED,
  OPS_MODEL_MAX_CALLS_PER_RUN,
  OPS_MODEL_MAX_TOKENS_PER_RUN,
  OPS_MODEL_MAX_TOKENS_PER_DAY,
  OPS_MODEL_MIN_INTERVAL_MS,
} from "./config.js";
export {
  OpsError,
  ValidationError,
  IdempotencyViolation,
  PreconditionFailed,
} from "./errors.js";

export * as Envelopes from "./envelopes/index.js";
export * as Identity from "./identity/index.js";
export * as Storage from "./storage/index.js";
export * as Outbox from "./outbox/index.js";
export * as WorkLedger from "./work-ledger/index.js";
export * as Projections from "./projections/index.js";
export * as Artifacts from "./artifacts/index.js";
export * as Feedback from "./feedback/index.js";
export * as Authz from "./authz/index.js";
export * as Egress from "./egress/index.js";
export * as Connectors from "./connectors/index.js";
export * as SafetyClasses from "./safety-classes/index.js";
export * as Execution from "./execution/index.js";
