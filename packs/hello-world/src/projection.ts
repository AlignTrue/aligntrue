import type {
  ProjectionDefinition,
  ProjectionFreshness,
  EventEnvelope,
} from "@aligntrue/core";
import { HELLO_EVENT } from "./handlers.js";

export interface HelloWorldState {
  count: number;
  last_event_id: string | null;
  last_ingested_at: string | null;
}

export const HelloWorldProjection: ProjectionDefinition<HelloWorldState> = {
  name: "hello-world-items",
  version: "1.0.0",
  init: () => ({
    count: 0,
    last_event_id: null,
    last_ingested_at: null,
  }),
  apply: (state: HelloWorldState, event: EventEnvelope): HelloWorldState => {
    if (event.event_type === HELLO_EVENT) {
      return {
        count: state.count + 1,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
    }
    return state;
  },
  getFreshness: (state: HelloWorldState): ProjectionFreshness => ({
    last_event_id: state.last_event_id,
    last_ingested_at: state.last_ingested_at,
  }),
};
