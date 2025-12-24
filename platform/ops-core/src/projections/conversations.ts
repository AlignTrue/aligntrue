import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import type { EventEnvelope } from "../envelopes/event.js";
import { hashCanonical } from "../identity/hash.js";
import {
  EMAIL_EVENT_TYPES,
  type EmailEventEnvelope,
} from "../connectors/google-gmail/events.js";
import {
  EMAIL_STATUS_EVENT_TYPES,
  type EmailStatusChangedPayload,
} from "../emails/events.js";
import type { EmailStatus } from "../emails/types.js";

export type ConversationChannel =
  | "email"
  | "slack"
  | "imessage"
  | "sms"
  | "teams"
  | "intercom";

export interface ConversationSummary {
  conversation_id: string;
  channel: ConversationChannel;
  subject?: string;
  last_sender?: string | undefined;
  participants: string[];
  last_message_at: string;
  last_message_snippet?: string;
  message_count: number;
  status: ConversationStatus;
  thread_id?: string;
}

export type ConversationStatus = "inbox" | "active" | "flagged" | "processed";

export interface ConversationsProjection {
  conversations: ConversationSummary[];
}

export interface ConversationsProjectionState extends ProjectionFreshness {
  conversations: Map<string, ConversationSummary>;
}

export const ConversationsProjectionDef: ProjectionDefinition<ConversationsProjectionState> =
  {
    name: "conversations",
    version: "1.0.0",
    init(): ConversationsProjectionState {
      return {
        conversations: new Map(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: ConversationsProjectionState,
      event: EventEnvelope,
    ): ConversationsProjectionState {
      switch (event.event_type) {
        case EMAIL_EVENT_TYPES.EmailMessageIngested: {
          const emailEvent = event as EmailEventEnvelope;
          const payload = emailEvent.payload;
          const key = payload.thread_id ?? payload.message_id;
          const next = new Map(state.conversations);
          const existing = next.get(key);

          const participants = collectParticipants(payload);
          const status: ConversationStatus = existing?.status ?? "inbox";

          const summary: ConversationSummary = existing
            ? {
                ...existing,
                last_sender: payload.from ?? existing.last_sender,
                participants: mergeParticipants(
                  existing.participants,
                  participants,
                ),
                last_message_at: payload.internal_date,
                ...(payload.snippet !== undefined && {
                  last_message_snippet: payload.snippet,
                }),
                message_count: existing.message_count + 1,
              }
            : {
                conversation_id: key,
                channel: "email",
                subject: payload.subject ?? "(no subject)",
                last_sender: payload.from,
                participants,
                last_message_at: payload.internal_date,
                ...(payload.snippet !== undefined && {
                  last_message_snippet: payload.snippet,
                }),
                message_count: 1,
                status,
                ...(payload.thread_id !== undefined && {
                  thread_id: payload.thread_id,
                }),
              };

          next.set(key, summary);
          return {
            conversations: next,
            last_event_id: event.event_id,
            last_ingested_at: event.ingested_at,
          };
        }
        case EMAIL_STATUS_EVENT_TYPES.EmailStatusChanged: {
          const payload = event.payload as EmailStatusChangedPayload;
          const key = payload.source_ref;
          const existing = state.conversations.get(key);
          if (!existing) {
            return state;
          }
          const next = new Map(state.conversations);
          const mappedStatus = mapEmailStatus(payload.to_status);
          next.set(key, { ...existing, status: mappedStatus });
          return {
            conversations: next,
            last_event_id: event.event_id,
            last_ingested_at: event.ingested_at,
          };
        }
        default:
          return state;
      }
    },
    getFreshness(state: ConversationsProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

export function buildConversationsProjectionFromState(
  state: ConversationsProjectionState,
): ConversationsProjection {
  const conversations = Array.from(state.conversations.values()).sort(
    (a, b) => {
      if (a.last_message_at === b.last_message_at) {
        return a.conversation_id.localeCompare(b.conversation_id);
      }
      return a.last_message_at > b.last_message_at ? -1 : 1;
    },
  );
  return { conversations };
}

export function hashConversationsProjection(
  projection: ConversationsProjection,
): string {
  return hashCanonical(projection);
}

function collectParticipants(payload: EmailEventEnvelope["payload"]): string[] {
  const participants = new Set<string>();
  if (payload.from) participants.add(payload.from);
  for (const list of [payload.to, payload.cc]) {
    if (!list) continue;
    for (const email of list) participants.add(email);
  }
  return Array.from(participants).sort();
}

function mergeParticipants(current: string[], incoming: string[]): string[] {
  const merged = new Set<string>([...current, ...incoming]);
  return Array.from(merged).sort();
}

function mapEmailStatus(status: EmailStatus): ConversationStatus {
  switch (status) {
    case "inbox":
      return "inbox";
    case "ai_todo":
      return "active";
    case "needs_human":
      return "flagged";
    case "processed":
      return "processed";
    default:
      return "inbox";
  }
}
