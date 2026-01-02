import { hashThreadSlice } from "./thread-slice.js";
import type { ThreadSlice, ThreadSliceEnriched } from "./thread-slice.js";
import type { SliceKind } from "./types.js";
import type { EmailClassification } from "./classification.js";

export interface EmailAssessmentContent {
  source_ref: string;
  thread_id: string;
  classification: EmailClassification;
  confidence: number;
  summary: string;
  rationale: string;
  model_version: string;
  prompt_version: string;
  input_hash: string;
  slice_kind: SliceKind;
  slice_version: string;
  assessed_at: string;
  fallback_from_snippet?: boolean;
  snippet_assessment_id?: string;
}

export function buildEmailAssessment(input: {
  threadSlice: ThreadSlice | ThreadSliceEnriched;
  aiOutput: {
    classification: EmailClassification;
    confidence: number;
    summary: string;
    rationale: string;
  };
  modelVersion: string;
  promptVersion: string;
  fallbackFrom?: { assessmentId: string };
}): EmailAssessmentContent {
  const mostRecentMessage = input.threadSlice.recent_messages.at(-1);

  return {
    source_ref: mostRecentMessage?.source_ref ?? "",
    thread_id: input.threadSlice.thread_id,
    classification: input.aiOutput.classification,
    confidence: input.aiOutput.confidence,
    summary: input.aiOutput.summary,
    rationale: input.aiOutput.rationale,
    model_version: input.modelVersion,
    prompt_version: input.promptVersion,
    input_hash: hashThreadSlice(input.threadSlice),
    slice_kind: input.threadSlice.slice_kind,
    slice_version: input.threadSlice.slice_version,
    assessed_at: new Date().toISOString(),
    ...(input.fallbackFrom
      ? {
          fallback_from_snippet: true,
          snippet_assessment_id: input.fallbackFrom.assessmentId,
        }
      : {}),
  };
}
