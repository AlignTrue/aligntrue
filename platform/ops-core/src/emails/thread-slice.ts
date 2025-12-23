import { Identity } from "../identity/index.js";
import type {
  ThreadMessage,
  ThreadProjection,
} from "../projections/threads.js";
import type { EmailClassification } from "./classification.js";
import type { SliceKind } from "./types.js";

export const THREAD_SLICE_VERSION = "v1";

export const THREAD_SLICE_RULES = {
  maxRecentMessages: 3,
  includeFirstIfLonger: true,
  maxSnippetLength: 200,
  fallback: {
    confidenceThreshold: 0.7,
    maxBodyLength: 1000,
    applicableClassifications: ["task", "simple_reply"] as const,
  },
} as const;

export interface SliceMessage {
  source_ref: string;
  message_id: string;
  from?: string;
  snippet: string;
  internal_date: string;
}

export interface SliceMessageWithBody extends SliceMessage {
  body_plain: string;
}

export interface ThreadSlice {
  thread_id: string;
  subject: string;
  participants: string[];
  has_attachments: boolean;
  message_count: number;
  first_message_at: string;
  last_message_at: string;
  recent_messages: SliceMessage[];
  first_message?: SliceMessage;
  slice_kind: SliceKind;
  slice_version: string;
}

export interface ThreadSliceEnriched extends Omit<
  ThreadSlice,
  "slice_kind" | "recent_messages"
> {
  slice_kind: "enriched";
  recent_messages: SliceMessageWithBody[];
  first_message?: SliceMessageWithBody;
}

export function buildThreadSlice(thread: ThreadProjection): ThreadSlice {
  const { maxRecentMessages, maxSnippetLength, includeFirstIfLonger } =
    THREAD_SLICE_RULES;

  const mapMessage = (m: ThreadMessage): SliceMessage => ({
    source_ref: m.source_ref,
    message_id: m.message_id,
    from: m.from ?? "",
    snippet: m.snippet?.slice(0, maxSnippetLength) ?? "",
    internal_date: m.internal_date,
  });

  const recentMessages = thread.messages
    .slice(-maxRecentMessages)
    .map(mapMessage);

  const includeFirst =
    includeFirstIfLonger && thread.messages.length > maxRecentMessages;
  const firstMessage = includeFirst ? thread.messages[0] : undefined;

  return {
    thread_id: thread.thread_id,
    subject: thread.subject,
    participants: thread.participants,
    has_attachments: thread.has_attachments,
    message_count: thread.message_count,
    first_message_at: thread.first_message_at,
    last_message_at: thread.last_message_at,
    recent_messages: recentMessages,
    ...(firstMessage ? { first_message: mapMessage(firstMessage) } : {}),
    slice_kind: "snippet",
    slice_version: THREAD_SLICE_VERSION,
  };
}

export function buildEnrichedSlice(
  baseSlice: ThreadSlice,
  bodies: Map<string, string>,
): ThreadSliceEnriched {
  const { first_message: baseFirstMessage, ...rest } = baseSlice;

  const enrichMessage = (m: SliceMessage): SliceMessageWithBody => ({
    ...m,
    body_plain:
      bodies
        .get(m.message_id)
        ?.slice(0, THREAD_SLICE_RULES.fallback.maxBodyLength) ?? "",
  });

  return {
    ...rest,
    slice_kind: "enriched",
    recent_messages: baseSlice.recent_messages.map(enrichMessage),
    ...(baseFirstMessage
      ? { first_message: enrichMessage(baseFirstMessage) }
      : {}),
  };
}

export function hashThreadSlice(
  slice: ThreadSlice | ThreadSliceEnriched,
): string {
  return Identity.deterministicId(slice);
}

export function needsFallbackFetch(
  classification: EmailClassification,
  confidence: number,
): boolean {
  const { fallback } = THREAD_SLICE_RULES;
  return (
    (fallback.applicableClassifications as readonly string[]).includes(
      classification,
    ) && confidence < fallback.confidenceThreshold
  );
}
