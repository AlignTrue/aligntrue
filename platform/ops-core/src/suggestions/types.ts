import type { DerivedArtifact } from "../artifacts/index.js";
import type { TaskBucket } from "../tasks/types.js";
import type { EmailStatus, SliceKind } from "../emails/types.js";

export type SuggestionType =
  | "task_triage"
  | "note_hygiene"
  | "email_conversion"
  | "email_triage";

export type SuggestionStatus = "new" | "approved" | "rejected" | "snoozed";

export type SuggestionOutputType = `suggestion:${SuggestionType}`;

export interface TaskTriageDiff {
  readonly type: "task_triage";
  readonly task_id: string;
  readonly from_bucket: TaskBucket;
  readonly to_bucket: TaskBucket;
  readonly reason: string;
  readonly due_at?: string | null;
}

export interface NoteHygieneDiff {
  readonly type: "note_hygiene";
  readonly note_id: string;
  readonly current_title: string;
  readonly suggested_title: string;
  readonly rationale: string;
}

export interface EmailConversionDiff {
  readonly type: "email_conversion";
  readonly source_ref: string;
  readonly message_id?: string;
  readonly to_entity: "task";
  readonly suggested_title: string;
}

export interface EmailTriageDiff {
  readonly type: "email_triage";
  readonly source_ref: string;
  readonly thread_id: string;
  readonly from_status: EmailStatus;
  readonly to_status: EmailStatus;
  readonly assessment_id: string;
  readonly slice_kind: SliceKind;
  readonly reason: string;
}

export type SuggestionDiff =
  | TaskTriageDiff
  | NoteHygieneDiff
  | EmailConversionDiff
  | EmailTriageDiff;

export interface SuggestionContent {
  readonly suggestion_type: SuggestionType;
  readonly target_refs: string[];
  readonly diff: SuggestionDiff;
  readonly rationale: string;
  readonly confidence?: number;
  readonly meta?: unknown;
}

export interface EmailTriageSuggestionMeta {
  confidence: number;
  slice_kind: SliceKind;
  assessment_id: string;
  supersedes_suggestion_id?: string;
  superseded_by_suggestion_id?: string;
  superseded_at?: string;
}

export function suggestionOutputType(
  type: SuggestionType,
): SuggestionOutputType {
  return `suggestion:${type}`;
}

export function isSuggestionArtifact(
  artifact: DerivedArtifact,
): artifact is DerivedArtifact & {
  readonly output_type: SuggestionOutputType;
  readonly output_data: SuggestionContent;
} {
  return artifact.output_type.startsWith("suggestion:");
}
