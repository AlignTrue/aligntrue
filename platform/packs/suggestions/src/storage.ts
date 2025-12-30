import { Storage, OPS_DATA_DIR } from "@aligntrue/ops-core";
import {
  InboxProjectionDef,
  buildInboxProjectionFromState,
  type InboxProjection,
  type InboxProjectionState,
} from "./projection.js";

export const DEFAULT_SUGGESTIONS_EVENTS_PATH = `${OPS_DATA_DIR}/pack-suggestions-events.jsonl`;
export const DEFAULT_FEEDBACK_EVENTS_PATH = `${OPS_DATA_DIR}/pack-suggestions-feedback.jsonl`;
export const DEFAULT_QUERY_ARTIFACTS_PATH = `${OPS_DATA_DIR}/pack-suggestions-query.jsonl`;
export const DEFAULT_DERIVED_ARTIFACTS_PATH = `${OPS_DATA_DIR}/pack-suggestions-derived.jsonl`;

export function createArtifactStore() {
  return new Storage.JsonlArtifactStore(
    DEFAULT_QUERY_ARTIFACTS_PATH,
    DEFAULT_DERIVED_ARTIFACTS_PATH,
  );
}

export function createSuggestionEventStore() {
  return new Storage.JsonlEventStore(DEFAULT_SUGGESTIONS_EVENTS_PATH);
}

export function createFeedbackEventStore() {
  return new Storage.JsonlEventStore(DEFAULT_FEEDBACK_EVENTS_PATH);
}

export async function rebuildInboxProjection(_opts: {} = {}): Promise<{
  projection: InboxProjection;
  state: InboxProjectionState;
}> {
  const suggestionStore = createSuggestionEventStore();
  const feedbackStore = createFeedbackEventStore();

  let state = InboxProjectionDef.init();
  for await (const event of suggestionStore.stream()) {
    state = InboxProjectionDef.apply(state, event);
  }
  for await (const event of feedbackStore.stream()) {
    state = InboxProjectionDef.apply(state, event);
  }

  const projection = buildInboxProjectionFromState(state);

  return { projection, state };
}
