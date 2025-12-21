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
export {
  RunsProjectionDef,
  buildRunsProjectionFromState,
  rebuildRuns,
} from "./runs.js";
export type { RunsProjectionState, RunSummary, StepSummary } from "./runs.js";
