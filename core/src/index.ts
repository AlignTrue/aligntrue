// Public API surface for ops-core
export {
  OPS_CONTACTS_ENABLED,
  OPS_CORE_ENABLED,
  OPS_CONNECTOR_GOOGLE_CALENDAR_ENABLED,
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  OPS_HYBRID_EXEC_ENABLED,
  OPS_MODEL_EGRESS_ENABLED,
  OPS_MODEL_MAX_CALLS_PER_RUN,
  OPS_MODEL_MAX_CALLS_PER_DAY,
  OPS_MODEL_MAX_TOKENS_PER_RUN,
  OPS_MODEL_MAX_TOKENS_PER_DAY,
  OPS_MODEL_MIN_INTERVAL_MS,
  OPS_TASKS_ENABLED,
  OPS_NOTES_ENABLED,
  OPS_GMAIL_MUTATIONS_ENABLED,
  OPS_GMAIL_SEND_ENABLED,
  OPS_SUGGESTIONS_ENABLED,
  OPS_PLANS_DAILY_ENABLED,
  OPS_PLANS_WEEKLY_ENABLED,
  OPS_MEMORY_PROVIDER_ENABLED,
  OPS_WEEKLY_PLAN_MAX_PER_WEEK,
  OPS_WEEKLY_PLAN_MIN_HOURS,
  OPS_EMAIL_STATUS_ENABLED,
  OPS_EMAIL_AUTO_COMMIT_ENABLED,
  OPS_AI_BASE_URL,
  OPS_AI_MODEL,
  OPS_AI_API_KEY,
  OPS_DATA_DIR,
} from "./config.js";
export {
  OpsError,
  ValidationError,
  IdempotencyViolation,
  PreconditionFailed,
} from "./errors.js";
export { defineCommandHandlers } from "./contracts/handler-registry.js";

export * as Envelopes from "./envelopes/index.js";
export { validateDedupeScope, computeScopeKey } from "./envelopes/command.js";
export * as Identity from "./identity/index.js";
export * as Storage from "./storage/index.js";
export { DEFAULT_EVENTS_PATH } from "./storage/index.js";
export * as Outbox from "./outbox/index.js";
export * as WorkLedger from "./work-ledger/index.js";
export * as Trajectories from "./trajectories/index.js";
export { handlePolicySetCommand } from "./handlers/policy.js";
export * as Projections from "./projections/index.js";
export * as EntityRef from "./entity-ref.js";
export * as Artifacts from "./artifacts/index.js";
export { BaseLedger } from "./ledger/base-ledger.js";
export * as Collections from "./utils/collections.js";
export type { ConversionMeta } from "./types/conversion.js";
export * as Feedback from "./feedback/index.js";
export * as Memory from "./memory/index.js";
export type {
  EventStore,
  CommandLog,
  CommandLogTryStartInput,
  CommandLogTryStartResult,
  ArtifactStore,
} from "./storage/interfaces.js";
export type {
  MemoryProvider,
  MemoryReference,
  QueryContext,
  IndexableItem,
  IndexResult,
} from "./memory/types.js";
export type { ActorRef } from "./envelopes/actor.js";
export type { EventEnvelope } from "./envelopes/event.js";
export type {
  CommandEnvelope,
  CommandOutcome,
  DedupeScope,
} from "./envelopes/command.js";
export { generateEventId, hashCanonical } from "./identity/index.js";
export { randomId, deterministicId } from "./identity/index.js";
// Experimental/unstable export: semantics public; enforcement not yet wired (see DR-007)
export * as Authz from "./authz/index.js";
export * as Egress from "./egress/index.js";
export * as SafetyClasses from "./safety-classes/index.js";
export * as Execution from "./execution/index.js";
export * as Emails from "./emails/index.js";
export * as AI from "./ai/index.js";
export * as Providers from "./providers/index.js";
export * as Contracts from "./contracts/index.js";
export type {
  EmailProvider,
  EmailFetchOpts,
  EmailBodyFetchOpts,
  CalendarProvider,
  CalendarFetchOpts,
} from "./providers/index.js";
export {
  registerEmailProvider,
  registerCalendarProvider,
  getEmailProvider,
  getCalendarProvider,
  listProviders,
} from "./providers/index.js";
export { evaluateEgress } from "./egress/index.js";
export type {
  EgressEnvelope,
  EgressReceipt,
  EgressGatewayRequest,
  EgressGatewayDecision,
} from "./egress/types.js";
export type { DocRef } from "./docrefs/index.js";
export type { PackManifest } from "./contracts/pack-manifest.js";
export { validatePackEventType } from "./contracts/pack-manifest.js";
export type {
  CapabilityGrant,
  CapabilityEventType,
} from "./contracts/capability.js";
export type {
  PackModule,
  PackContext,
  PackEventHandler,
  PackCommandHandler,
} from "./contracts/pack-module.js";
export type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./projections/definition.js";
export type { ProjectionRegistry } from "./projections/registry.js";
