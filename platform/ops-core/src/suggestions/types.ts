import type { DerivedArtifact } from "../artifacts/index.js";
import type { TaskBucket } from "../tasks/types.js";

export type SuggestionType =
  | "task_triage"
  | "note_hygiene"
  | "email_conversion";

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

export type SuggestionDiff =
  | TaskTriageDiff
  | NoteHygieneDiff
  | EmailConversionDiff;

export interface SuggestionContent {
  readonly suggestion_type: SuggestionType;
  readonly target_refs: string[];
  readonly diff: SuggestionDiff;
  readonly rationale: string;
  readonly confidence?: number;
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
