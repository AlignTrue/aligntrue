import type { PackModule } from "@aligntrue/core";
import { manifest } from "./manifest.js";
import { commandHandlers } from "./command-handlers.js";
import { InboxProjectionDef } from "./projection.js";
import { createSuggestionStores } from "./storage.js";

const stores = createSuggestionStores();

const moduleImpl: PackModule = {
  manifest,
  commandHandlers,
  projections: [InboxProjectionDef],
  extendContext: (base) => ({
    ...base,
    artifactStore: stores.artifactStore,
    feedbackEventStore: stores.feedbackEventStore,
    suggestionEventStore: stores.suggestionEventStore,
  }),
};

export default moduleImpl;
export { manifest } from "./manifest.js";
export { commandHandlers } from "./command-handlers.js";
export {
  InboxProjectionDef,
  SUGGESTIONS_PROJECTION,
  type InboxProjection,
  type InboxProjectionState,
  type InboxItem,
  buildInboxProjectionFromState,
  hashInboxProjection,
} from "./projection.js";
export { SuggestionExecutor, type SuggestionExecutorDeps } from "./executor.js";
export {
  isSuggestionArtifact,
  suggestionOutputType,
  type SuggestionContent,
  type SuggestionStatus,
  type SuggestionAction,
  type SuggestionDiff,
} from "./types.js";
export {
  buildSuggestionCommand,
  type SuggestionCommandEnvelope,
  type SuggestionCommandPayload,
} from "./commands.js";
export {
  createArtifactStore,
  createSuggestionEventStore,
  createFeedbackEventStore,
  rebuildInboxProjection,
  DEFAULT_SUGGESTIONS_EVENTS_PATH,
  DEFAULT_FEEDBACK_EVENTS_PATH,
  DEFAULT_QUERY_ARTIFACTS_PATH,
  DEFAULT_DERIVED_ARTIFACTS_PATH,
} from "./storage.js";
export * as SuggestionTypes from "./types.js";
export * as SuggestionEvents from "./events.js";
export * as SuggestionGenerators from "./generators.js";
export * from "./daily-plan.js";
export * from "./weekly-plan.js";
export * as SuggestionPlans from "./daily-plan.js";
export * as WeeklyPlans from "./weekly-plan.js";
