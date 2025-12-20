// Public API surface for ops-core
export { OPS_CORE_ENABLED } from "./config.js";
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
