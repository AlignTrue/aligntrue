import { Identity } from "../identity/index.js";
import type { EmailStatus, SliceKind } from "./types.js";

export interface AssessmentDedupeKey {
  thread_id: string;
  slice_kind: SliceKind;
  input_hash: string;
  prompt_version: string;
  model_version: string;
}

export function assessmentDedupeId(key: AssessmentDedupeKey): string {
  return Identity.deterministicId({
    type: "email_assessment",
    ...key,
  });
}

export interface SuggestionActiveKey {
  thread_id: string;
  from_status: EmailStatus;
  to_status: EmailStatus;
}

export function suggestionActiveId(key: SuggestionActiveKey): string {
  return Identity.deterministicId({
    type: "email_triage_suggestion_active",
    ...key,
  });
}

export interface SupersedeRecord {
  superseded_suggestion_id: string;
  superseded_by_suggestion_id: string;
  superseded_at: string;
  reason: "higher_confidence" | "newer_assessment" | "manual";
  old_assessment_id: string;
  new_assessment_id: string;
  old_confidence: number;
  new_confidence: number;
}

export const DEDUPE_RULES = {
  skipAssessmentIfExists: true,
  supersedeOnHigherConfidence: true,
  confidenceThresholdForSupersede: 0.05,
  recordSupersedeHistory: true,
} as const;
