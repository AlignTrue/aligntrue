import type {
  ProjectionDefinition,
  ProjectionFreshness,
} from "./definition.js";
import type { EventEnvelope } from "../envelopes/index.js";
import {
  EMAIL_EVENT_TYPES,
  type EmailEventEnvelope,
} from "../connectors/google-gmail/events.js";
import { hashCanonical } from "../identity/hash.js";

export interface ThreadMessage {
  source_ref: string;
  message_id: string;
  thread_id: string;
  from?: string;
  snippet?: string;
  internal_date: string;
  has_attachments: boolean;
}

export interface ThreadProjection {
  thread_id: string;
  subject: string;
  participants: string[];
  has_attachments: boolean;
  message_count: number;
  first_message_at: string;
  last_message_at: string;
  messages: ThreadMessage[];
}

export interface ThreadsProjection {
  threads: ThreadProjection[];
}

export interface ThreadsProjectionState extends ProjectionFreshness {
  threads: Map<string, ThreadProjection>;
}

export const ThreadsProjectionDef: ProjectionDefinition<ThreadsProjectionState> =
  {
    name: "threads",
    version: "1.0.0",
    init(): ThreadsProjectionState {
      return {
        threads: new Map(),
        last_event_id: null,
        last_ingested_at: null,
      };
    },
    apply(
      state: ThreadsProjectionState,
      event: EventEnvelope,
    ): ThreadsProjectionState {
      if (event.event_type !== EMAIL_EVENT_TYPES.EmailMessageIngested) {
        return state;
      }
      const emailEvent = event as EmailEventEnvelope;
      const payload = emailEvent.payload;
      const next = new Map(state.threads);
      const existing = next.get(payload.thread_id);

      const message: ThreadMessage = {
        source_ref: payload.source_ref,
        message_id: payload.message_id,
        thread_id: payload.thread_id,
        ...(payload.from ? { from: payload.from } : {}),
        ...(payload.snippet ? { snippet: payload.snippet } : {}),
        internal_date: payload.internal_date,
        has_attachments: Boolean(payload.doc_refs?.length),
      };

      if (!existing) {
        const projection: ThreadProjection = {
          thread_id: payload.thread_id,
          subject: payload.subject ?? "(no subject)",
          participants: collectParticipants(payload),
          has_attachments: message.has_attachments,
          message_count: 1,
          first_message_at: payload.internal_date,
          last_message_at: payload.internal_date,
          messages: [message],
        };
        next.set(payload.thread_id, projection);
      } else {
        const messages = existing.messages.concat(message);
        messages.sort((a, b) =>
          a.internal_date === b.internal_date
            ? a.message_id.localeCompare(b.message_id)
            : a.internal_date.localeCompare(b.internal_date),
        );
        existing.messages = messages;
        existing.message_count = messages.length;
        existing.first_message_at =
          messages[0]?.internal_date ?? payload.internal_date;
        existing.last_message_at =
          messages[messages.length - 1]?.internal_date ?? payload.internal_date;
        existing.has_attachments =
          existing.has_attachments || message.has_attachments;
        existing.participants = mergeParticipants(
          existing.participants,
          collectParticipants(payload),
        );
      }

      return {
        threads: next,
        last_event_id: event.event_id,
        last_ingested_at: event.ingested_at,
      };
    },
    getFreshness(state: ThreadsProjectionState): ProjectionFreshness {
      return {
        last_event_id: state.last_event_id,
        last_ingested_at: state.last_ingested_at,
      };
    },
  };

export function buildThreadsProjectionFromState(
  state: ThreadsProjectionState,
): ThreadsProjection {
  const threads = Array.from(state.threads.values()).sort((a, b) => {
    if (a.last_message_at === b.last_message_at) {
      return a.thread_id.localeCompare(b.thread_id);
    }
    return a.last_message_at > b.last_message_at ? -1 : 1;
  });
  return { threads };
}

export function hashThreadsProjection(projection: ThreadsProjection): string {
  return hashCanonical(projection);
}

function collectParticipants(event: EmailEventEnvelope["payload"]): string[] {
  const participants = new Set<string>();
  if (event.from) participants.add(event.from);
  for (const list of [event.to, event.cc]) {
    if (list) {
      for (const email of list) {
        participants.add(email);
      }
    }
  }
  return Array.from(participants).sort();
}

function mergeParticipants(current: string[], incoming: string[]): string[] {
  const merged = new Set<string>([...current, ...incoming]);
  return Array.from(merged).sort();
}
