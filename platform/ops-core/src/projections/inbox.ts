import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import type { EventEnvelope } from "../envelopes/index.js";
import { hashCanonical } from "../identity/hash.js";
import * as Feedback from "../feedback/index.js";
import {
  SUGGESTION_EVENT_TYPES,
  type SuggestionGeneratedEvent,
} from "../suggestions/events.js";
import type { SuggestionStatus, SuggestionType } from "../suggestions/types.js";

export interface InboxItem {
  suggestion_id: string;
  suggestion_type: SuggestionType;
  target_refs: string[];
  status: SuggestionStatus;
  created_at: string;
  feedback_at?: string;
}

export interface InboxProjection {
  suggestions: InboxItem[];
}

export interface InboxProjectionState extends ProjectionFreshness {
  suggestions: Map<string, InboxItem>;
}

export const InboxProjectionDef: ProjectionDefinition<InboxProjectionState> = {
  name: "suggestion_inbox",
  version: "1.0.0",
  init(): InboxProjectionState {
    return {
      suggestions: new Map(),
      last_event_id: null,
      last_ingested_at: null,
    };
  },
  apply(
    state: InboxProjectionState,
    event: EventEnvelope,
  ): InboxProjectionState {
    switch (event.event_type) {
      case SUGGESTION_EVENT_TYPES.SuggestionGenerated: {
        const suggestionEvent = event as SuggestionGeneratedEvent;
        const next = new Map(state.suggestions);
        if (!next.has(suggestionEvent.payload.suggestion_id)) {
          next.set(suggestionEvent.payload.suggestion_id, {
            suggestion_id: suggestionEvent.payload.suggestion_id,
            suggestion_type: suggestionEvent.payload.suggestion_type,
            target_refs: suggestionEvent.payload.target_refs,
            status: "new",
            created_at: suggestionEvent.occurred_at,
          });
        }
        return {
          suggestions: next,
          last_event_id: suggestionEvent.event_id,
          last_ingested_at: suggestionEvent.ingested_at,
        };
      }
      default: {
        if (Feedback.isFeedbackEvent(event)) {
          const feedback = event as Feedback.FeedbackEvent;
          const targetId = feedback.payload.artifact_id;
          if (!state.suggestions.has(targetId)) return state;
          const next = new Map(state.suggestions);
          const existing = next.get(targetId);
          if (!existing) return state;
          const status = mapFeedbackToStatus(feedback);
          next.set(targetId, {
            ...existing,
            status,
            feedback_at: feedback.occurred_at,
          });
          return {
            suggestions: next,
            last_event_id: feedback.event_id,
            last_ingested_at: feedback.ingested_at,
          };
        }
        return state;
      }
    }
  },
  getFreshness(state: InboxProjectionState): ProjectionFreshness {
    return {
      last_event_id: state.last_event_id,
      last_ingested_at: state.last_ingested_at,
    };
  },
};

export function buildInboxProjectionFromState(
  state: InboxProjectionState,
): InboxProjection {
  const suggestions = Array.from(state.suggestions.values()).sort((a, b) => {
    if (a.status !== b.status) {
      // new first, snoozed, rejected, approved sorted by name
      return a.status.localeCompare(b.status);
    }
    if (a.created_at === b.created_at) {
      return a.suggestion_id.localeCompare(b.suggestion_id);
    }
    return a.created_at > b.created_at ? -1 : 1;
  });
  return { suggestions };
}

export function hashInboxProjection(projection: InboxProjection): string {
  return hashCanonical(projection);
}

function mapFeedbackToStatus(event: Feedback.FeedbackEvent): SuggestionStatus {
  switch (event.event_type) {
    case Feedback.FEEDBACK_TYPES.Accepted:
      return "approved";
    case Feedback.FEEDBACK_TYPES.Rejected:
    case Feedback.FEEDBACK_TYPES.Overridden:
      return "rejected";
    case Feedback.FEEDBACK_TYPES.Snoozed:
      return "snoozed";
    default:
      return "new";
  }
}
