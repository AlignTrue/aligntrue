import type {
  ProjectionDefinition,
  ProjectionFreshness,
  EventEnvelope,
} from "@aligntrue/core";
import { Identity, Feedback, Contracts } from "@aligntrue/core";
import type { SuggestionStatus, SuggestionType } from "./types.js";

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
  last_event_id: string | null;
  last_ingested_at: string | null;
}

export const SUGGESTIONS_PROJECTION = "pack.suggestions.inbox" as const;

export const InboxProjectionDef: ProjectionDefinition<InboxProjectionState> = {
  name: SUGGESTIONS_PROJECTION,
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
      case Contracts.SUGGESTION_EVENT_TYPES.Generated: {
        const suggestionEvent = event as EventEnvelope<
          (typeof Contracts.SUGGESTION_EVENT_TYPES)["Generated"],
          {
            suggestion_id: string;
            suggestion_type: SuggestionType;
            target_refs: string[];
          }
        >;
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
  return Identity.hashCanonical(projection);
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
