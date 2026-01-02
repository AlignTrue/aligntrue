export {
  type ProjectionDefinition,
  type ProjectionFreshness,
} from "./definition.js";
export {
  ProjectionRegistry,
  defaultRegistry,
  projectionKey,
} from "./registry.js";
export {
  rebuildOne,
  rebuildAll,
  rebuildWorkLedger,
  type ProjectionOutput,
} from "./rebuild.js";
export {
  TimelineProjectionDef,
  buildTimelineProjectionFromState,
  replayTimeline,
  hashTimelineProjection,
} from "./timeline.js";
export type {
  TimelineProjectionState,
  TimelineProjection,
} from "./timeline.js";
export type { DocRef } from "../docrefs/index.js";
export {
  ContactsProjectionDef,
  buildContactsProjectionFromState,
  hashContactIdFromEmail,
  hashContactIdSourceScoped,
  normalizeEmail as normalizeContactEmail,
  extractContactIdsFromEvent,
} from "./contacts.js";
export type {
  ContactsProjectionState,
  ContactProjection,
  Contact,
} from "./contacts.js";
export {
  buildWorkItemsProjection,
  buildWorkItemsProjectionFromState,
  WorkItemsProjectionDef,
} from "./work-items.js";
export {
  buildReadyQueueProjection,
  buildReadyQueueProjectionFromState,
  ReadyQueueProjectionDef,
} from "./ready-queue.js";
export type { WorkItemsProjection, WorkItemView } from "./work-items.js";
export type {
  ReadyQueueProjection,
  ReadyQueueProjectionState,
} from "./ready-queue.js";
export type {
  WorkLedgerProjections,
  ProjectionOutput as WorkLedgerProjectionOutput,
} from "./rebuild.js";
export { RunsProjectionDef, buildRunsProjectionFromState } from "./runs.js";
export { rebuildRuns } from "./rebuild.js";
export type { ExecutionProjections } from "./rebuild.js";
export type { RunsProjectionState, RunSummary, StepSummary } from "./runs.js";
export {
  ThreadsProjectionDef,
  buildThreadsProjectionFromState,
  hashThreadsProjection,
} from "./threads.js";
export type {
  ThreadsProjection,
  ThreadProjection,
  ThreadMessage,
} from "./threads.js";
export {
  KnownSendersProjectionDef,
  buildKnownSendersProjection,
  KNOWN_SENDERS_VERSION,
} from "./known-senders.js";
export type { KnownSendersProjection } from "./known-senders.js";
export {
  ConversationsProjectionDef,
  buildConversationsProjectionFromState,
  hashConversationsProjection,
} from "./conversations.js";
export type {
  ConversationsProjection,
  ConversationsProjectionState,
  ConversationSummary,
  ConversationStatus,
  ConversationChannel,
} from "./conversations.js";
export {
  computeFreeWindows,
  hashFreeWindowsProjection,
  type FreeWindow,
  type FreeWindowsProjection,
} from "./free-windows.js";
export {
  ActivePolicyProjectionDef,
  buildActivePolicyProjectionFromState,
} from "./policy.js";
export type { ActivePolicyProjection } from "./policy.js";
export {
  ReceiptsProjectionDef,
  buildReceiptsProjectionFromState,
  getReceiptsForEntity,
  hashReceiptsProjection,
} from "./receipts.js";
export type {
  ReceiptsProjection,
  ReceiptsProjectionState,
  Receipt,
  ReceiptKind,
} from "./receipts.js";
export { entityRef, parseEntityRef } from "../entity-ref.js";
export type { EntityType } from "../entity-ref.js";
