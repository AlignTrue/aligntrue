import { OPS_SUGGESTIONS_ENABLED, OPS_DATA_DIR } from "../config.js";
import { hashCanonical } from "../identity/hash.js";
import type { EventEnvelope } from "../envelopes/event.js";
import {
  InboxProjectionDef,
  buildInboxProjectionFromState,
} from "../projections/inbox.js";
import { JsonlArtifactStore, JsonlEventStore } from "../storage/index.js";
import { join } from "node:path";

export * from "./types.js";
export * from "./events.js";
export * from "./generators.js";
export * from "./commands.js";
export * from "./executor.js";
export * from "./daily-plan.js";
export * from "./weekly-plan.js";

export const DEFAULT_SUGGESTIONS_EVENTS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-suggestions.jsonl",
);
export const DEFAULT_FEEDBACK_EVENTS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-feedback.jsonl",
);
export const DEFAULT_QUERY_ARTIFACTS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-query-artifacts.jsonl",
);
export const DEFAULT_DERIVED_ARTIFACTS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-derived-artifacts.jsonl",
);
export const DEFAULT_INBOX_PROJECTION_PATH = DEFAULT_SUGGESTIONS_EVENTS_PATH;

export function createSuggestionEventStore(
  eventsPath: string = DEFAULT_SUGGESTIONS_EVENTS_PATH,
): JsonlEventStore {
  return new JsonlEventStore(eventsPath);
}

export function createFeedbackEventStore(
  eventsPath: string = DEFAULT_FEEDBACK_EVENTS_PATH,
): JsonlEventStore {
  return new JsonlEventStore(eventsPath);
}

export function createArtifactStore(opts?: {
  queryPath?: string;
  derivedPath?: string;
}): JsonlArtifactStore {
  return new JsonlArtifactStore(
    opts?.queryPath ?? DEFAULT_QUERY_ARTIFACTS_PATH,
    opts?.derivedPath ?? DEFAULT_DERIVED_ARTIFACTS_PATH,
  );
}

export function ensureSuggestionsEnabled(): void {
  if (!OPS_SUGGESTIONS_ENABLED) {
    throw new Error("Suggestions are disabled (OPS_SUGGESTIONS_ENABLED=0)");
  }
}

export async function rebuildInboxProjection(opts?: {
  suggestionEventsPath?: string;
  feedbackEventsPath?: string;
}) {
  const suggestionEvents = createSuggestionEventStore(
    opts?.suggestionEventsPath,
  );
  const feedbackEvents = createFeedbackEventStore(opts?.feedbackEventsPath);

  let state = InboxProjectionDef.init();
  const combined = await mergeEventsByIngested([
    suggestionEvents.stream(),
    feedbackEvents.stream(),
  ]);
  for (const event of combined) {
    state = InboxProjectionDef.apply(state, event);
  }
  const freshness = InboxProjectionDef.getFreshness(state);
  const projection = buildInboxProjectionFromState(state);
  return {
    projection,
    freshness,
    hash: hashCanonical({ projection, freshness }),
  };
}

async function mergeEventsByIngested(
  streams: AsyncIterable<EventEnvelope>[],
): Promise<EventEnvelope[]> {
  const all: EventEnvelope[] = [];
  for (const stream of streams) {
    for await (const event of stream) {
      all.push(event);
    }
  }
  return all.sort((a, b) => {
    if (a.ingested_at === b.ingested_at) {
      return a.event_id.localeCompare(b.event_id);
    }
    return a.ingested_at > b.ingested_at ? 1 : -1;
  });
}
