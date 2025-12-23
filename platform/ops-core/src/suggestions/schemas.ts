import { z } from "zod";
import type {
  ThreadSlice,
  ThreadSliceEnriched,
} from "../emails/thread-slice.js";

export const EMAIL_PROMPT_VERSION = "v1";

export const emailClassificationSchema = z.object({
  classification: z.enum([
    "informational",
    "simple_reply",
    "complex_reply",
    "task",
    "ambiguous",
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(200),
  rationale: z.string().max(500),
});

export type AIClassificationOutput = z.infer<typeof emailClassificationSchema>;

export function buildEmailPrompt(slice: ThreadSlice): string {
  return `Classify this email thread for triage.

Thread: ${slice.subject}
Participants: ${slice.participants.join(", ")}
Has attachments: ${slice.has_attachments}
Message count: ${slice.message_count}

Recent messages:
${slice.recent_messages
  .map((m) => `From: ${m.from ?? "unknown"}\n${m.snippet}`)
  .join("\n---\n")}

Classify as:
- informational: Newsletter, notification, no action needed
- simple_reply: Needs a brief response (few words)
- complex_reply: Needs substantial thought or research
- task: Contains an actionable item to track
- ambiguous: Unclear, needs human review

Respond with classification, confidence (0-1), summary, and rationale.`;
}

export function buildEmailPromptWithBody(slice: ThreadSliceEnriched): string {
  const bodies = slice.recent_messages
    .map(
      (m) =>
        `From: ${m.from ?? "unknown"}\nSnippet: ${m.snippet}\nBody: ${m.body_plain}`,
    )
    .join("\n---\n");

  return `Classify this email thread for triage with enriched body context.

Thread: ${slice.subject}
Participants: ${slice.participants.join(", ")}
Has attachments: ${slice.has_attachments}
Message count: ${slice.message_count}

Recent messages with body:
${bodies}

Classify as:
- informational: Newsletter, notification, no action needed
- simple_reply: Needs a brief response (few words)
- complex_reply: Needs substantial thought or research
- task: Contains an actionable item to track
- ambiguous: Unclear, needs human review

Respond with classification, confidence (0-1), summary, and rationale.`;
}
