import {
  OPS_SUGGESTIONS_ENABLED,
  Identity,
  Contracts,
  Artifacts,
  Projections,
  type ActorRef,
  type ArtifactStore,
} from "@aligntrue/core";
import { suggestionOutputType, type SuggestionContent } from "./types.js";
import {
  buildSuggestionGeneratedEvent,
  type SuggestionGeneratedEvent,
} from "./events.js";

export interface SuggestionGeneratorResult {
  artifacts: Artifacts.DerivedArtifact[];
  events: SuggestionGeneratedEvent[];
}

export interface GeneratorCommonInput {
  readonly artifactStore: ArtifactStore<
    Artifacts.QueryArtifact,
    Artifacts.DerivedArtifact
  >;
  readonly actor: ActorRef;
  readonly now?: string;
  readonly correlation_id?: string;
  readonly policy_version?: string;
}

type TasksProjection = {
  tasks: Array<{
    id: string;
    title: string;
    bucket: Contracts.TaskBucket;
    status: Contracts.TaskStatus;
    impact?: Contracts.TaskImpact;
    effort?: Contracts.TaskEffort;
    due_at?: string | null;
    updated_at: string;
  }>;
};

export interface TaskTriageGeneratorInput extends GeneratorCommonInput {
  readonly tasks: TasksProjection;
  readonly tasks_hash: string;
  readonly window_days?: number;
}

type NotesProjection = {
  notes: Array<{
    id: string;
    title: string;
    body_md: string;
    content_hash: string;
  }>;
};

export interface NoteHygieneGeneratorInput extends GeneratorCommonInput {
  readonly notes: NotesProjection;
  readonly notes_hash: string;
  readonly notes_projection_version: string;
}

export interface EmailConversionGeneratorInput extends GeneratorCommonInput {
  // Placeholder for future email ingestion-derived suggestions.
  readonly emails?: unknown;
}

export interface EmailTriageGeneratorInput extends GeneratorCommonInput {
  readonly threads: Projections.ThreadsProjection;
  readonly knownSenders: Projections.KnownSendersProjection;
  readonly gmailFetcher: {
    fetchBodies(ids: string[]): Promise<Map<string, string>>;
  };
  readonly modelVersion: string;
}

export async function generateTaskTriageSuggestions(
  input: TaskTriageGeneratorInput,
): Promise<SuggestionGeneratorResult> {
  if (!OPS_SUGGESTIONS_ENABLED) {
    return emptyResult();
  }

  const now = input.now ?? new Date().toISOString();
  const correlation_id = input.correlation_id ?? Identity.randomId();
  const policy_version = input.policy_version ?? "suggestions@0.0.1";
  const window_days = input.window_days ?? 7;
  const cutoff = addDays(now, window_days);

  const artifacts: Artifacts.DerivedArtifact[] = [];
  const events: SuggestionGeneratedEvent[] = [];

  const query = Artifacts.buildQueryArtifact({
    referenced_entities: ["task"],
    referenced_fields: ["id", "bucket", "status", "due_at"],
    filters: { bucket: "later", due_within_days: window_days },
    projection_version: Contracts.TASK_PROJECTION,
    created_at: now,
    created_by: input.actor,
    correlation_id,
  });
  await input.artifactStore.putQueryArtifact(query);

  for (const task of input.tasks.tasks) {
    if (task.bucket !== "later") continue;
    if (!task.due_at) continue;
    const due = Date.parse(task.due_at);
    if (Number.isNaN(due)) continue;
    if (due > cutoff) continue;

    const target_ref = `task:${task.id}`;
    const suggestionContent: SuggestionContent = {
      suggestion_type: "task_triage",
      target_refs: [target_ref],
      diff: {
        type: "task_triage",
        task_id: task.id,
        from_bucket: task.bucket,
        to_bucket: "week",
        reason: "Due within 7 days; move to week",
        due_at: task.due_at,
      },
      rationale: "Task is in later but due soon; triage to week for attention.",
      confidence: 0.6,
    };

    const derived = Artifacts.buildDerivedArtifact({
      input_query_ids: [query.artifact_id],
      input_hashes: [query.content_hash, input.tasks_hash],
      policy_version,
      output_type: suggestionOutputType("task_triage"),
      output_data: suggestionContent,
      ...(suggestionContent.confidence !== undefined && {
        confidence: suggestionContent.confidence,
      }),
      explanation: suggestionContent.rationale,
      created_at: now,
      created_by: input.actor,
      correlation_id,
    });

    await input.artifactStore.putDerivedArtifact(derived);
    artifacts.push(derived);
    events.push(
      buildSuggestionGeneratedEvent({
        suggestion_id: derived.artifact_id,
        suggestion_type: "task_triage",
        target_refs: suggestionContent.target_refs,
        correlation_id,
        actor: input.actor,
        occurred_at: now,
      }),
    );
  }

  return { artifacts, events };
}

export async function generateNoteHygieneSuggestions(
  input: NoteHygieneGeneratorInput,
): Promise<SuggestionGeneratorResult> {
  if (!OPS_SUGGESTIONS_ENABLED) {
    return emptyResult();
  }

  const now = input.now ?? new Date().toISOString();
  const correlation_id = input.correlation_id ?? Identity.randomId();
  const policy_version = input.policy_version ?? "suggestions@0.0.1";

  const artifacts: Artifacts.DerivedArtifact[] = [];
  const events: SuggestionGeneratedEvent[] = [];

  const query = Artifacts.buildQueryArtifact({
    referenced_entities: ["note"],
    referenced_fields: ["id", "title", "body_md"],
    filters: { title: "missing_or_empty" },
    projection_version: input.notes_projection_version,
    created_at: now,
    created_by: input.actor,
    correlation_id,
  });
  await input.artifactStore.putQueryArtifact(query);

  for (const note of input.notes.notes) {
    if (note.title && note.title.trim().length > 0) continue;

    const suggested = firstNonEmptyLine(note.body_md) ?? "Untitled note";
    const rationale = "Note is missing a title; promote first line as title.";
    const target_refs = [`note:${note.id}`];
    const suggestionContent: SuggestionContent = {
      suggestion_type: "note_hygiene",
      target_refs,
      diff: {
        type: "note_hygiene",
        note_id: note.id,
        current_title: note.title,
        suggested_title: suggested,
        rationale,
      },
      rationale,
      confidence: 0.5,
    };

    const derived = Artifacts.buildDerivedArtifact({
      input_query_ids: [query.artifact_id],
      input_hashes: [query.content_hash, input.notes_hash],
      policy_version,
      output_type: suggestionOutputType("note_hygiene"),
      output_data: suggestionContent,
      ...(suggestionContent.confidence !== undefined && {
        confidence: suggestionContent.confidence,
      }),
      explanation: suggestionContent.rationale,
      created_at: now,
      created_by: input.actor,
      correlation_id,
    });

    await input.artifactStore.putDerivedArtifact(derived);
    artifacts.push(derived);
    events.push(
      buildSuggestionGeneratedEvent({
        suggestion_id: derived.artifact_id,
        suggestion_type: "note_hygiene",
        target_refs,
        correlation_id,
        actor: input.actor,
        occurred_at: now,
      }),
    );
  }

  return { artifacts, events };
}

export async function generateEmailConversionSuggestions(
  _input: EmailConversionGeneratorInput,
): Promise<SuggestionGeneratorResult> {
  // Placeholder: no email-derived suggestions until email ingest pipeline supplies context.
  return emptyResult();
}

export async function generateEmailTriageSuggestions(
  _input: EmailTriageGeneratorInput,
): Promise<SuggestionGeneratorResult> {
  if (!OPS_SUGGESTIONS_ENABLED) {
    return emptyResult();
  }
  return emptyResult();
}

export function combineResults(
  ...results: SuggestionGeneratorResult[]
): SuggestionGeneratorResult {
  return {
    artifacts: results.flatMap((r) => r.artifacts),
    events: results.flatMap((r) => r.events),
  };
}

function addDays(iso: string, days: number): number {
  const base = Date.parse(iso);
  if (Number.isNaN(base)) return Number.NaN;
  return base + days * 24 * 60 * 60 * 1000;
}

function firstNonEmptyLine(body: string): string | undefined {
  const lines = body.split("\n").map((line) => line.trim());
  for (const line of lines) {
    if (line.length > 0) return line;
  }
  return undefined;
}

function emptyResult(): SuggestionGeneratorResult {
  return { artifacts: [], events: [] };
}
