import {
  OPS_NOTES_ENABLED,
  OPS_SUGGESTIONS_ENABLED,
  OPS_TASKS_ENABLED,
} from "../config.js";
import { ValidationError, PreconditionFailed } from "../errors.js";
import type { CommandEnvelope, CommandOutcome } from "../envelopes/command.js";
import type { EventEnvelope } from "../envelopes/event.js";
import type { ActorRef } from "../envelopes/actor.js";
import { Identity } from "../identity/index.js";
import type {
  ArtifactStore,
  CommandLog,
  EventStore,
} from "../storage/interfaces.js";
import { JsonlCommandLog } from "../storage/index.js";
import * as Tasks from "../tasks/index.js";
import * as Notes from "../notes/index.js";
import * as Feedback from "../feedback/index.js";
import type {
  ApproveSuggestionPayload,
  SuggestionCommandEnvelope,
} from "./commands.js";
import {
  isSuggestionArtifact,
  suggestionOutputType,
  type SuggestionContent,
  type SuggestionStatus,
} from "./types.js";

export const DEFAULT_SUGGESTION_COMMANDS_PATH =
  "./data/ops-core-suggestion-commands.jsonl";
export const DEFAULT_SUGGESTION_OUTCOMES_PATH =
  "./data/ops-core-suggestion-command-outcomes.jsonl";

export interface SuggestionExecutorDeps {
  readonly artifactStore: ArtifactStore<
    import("../artifacts/index.js").QueryArtifact,
    import("../artifacts/index.js").DerivedArtifact
  >;
  readonly feedbackEventStore: EventStore;
  readonly suggestionEventStore?: EventStore;
  readonly commandLog?: CommandLog;
  readonly now?: () => string;
}

export class SuggestionExecutor {
  private readonly now: () => string;
  private readonly commandLog: CommandLog;

  constructor(private readonly deps: SuggestionExecutorDeps) {
    this.now = deps.now ?? (() => new Date().toISOString());
    this.commandLog =
      deps.commandLog ??
      new JsonlCommandLog(
        DEFAULT_SUGGESTION_COMMANDS_PATH,
        DEFAULT_SUGGESTION_OUTCOMES_PATH,
      );
  }

  async approve(
    command: SuggestionCommandEnvelope<"suggestion.approve">,
  ): Promise<CommandOutcome> {
    ensureSuggestionsEnabled();
    const payload = command.payload as ApproveSuggestionPayload;

    const existing = await this.commandLog.getByIdempotencyKey(
      command.command_id,
    );
    if (existing) return existing;

    const artifact = await this.deps.artifactStore.getDerivedById(
      command.payload.suggestion_id,
    );
    if (!artifact || !isSuggestionArtifact(artifact)) {
      throw new PreconditionFailed("exists", "missing");
    }

    const status = await this.getStatus(command.payload.suggestion_id);
    if (status !== "new") {
      return this.finish(command, [], "already_processed", status);
    }

    if (artifact.content_hash !== payload.expected_hash) {
      throw new PreconditionFailed(
        payload.expected_hash,
        artifact.content_hash,
      );
    }

    const producedEvents: string[] = [];
    await this.executeDomainCommand(artifact, command.actor);

    const feedbackEvent = Feedback.buildFeedbackEvent({
      artifact_id: artifact.artifact_id,
      feedback_type: Feedback.FEEDBACK_TYPES.Accepted,
      correlation_id: command.correlation_id,
      causation_id: command.command_id,
      actor: command.actor,
      occurred_at: this.now(),
    });
    await this.deps.feedbackEventStore.append(feedbackEvent);
    producedEvents.push(feedbackEvent.event_id);

    return this.finish(command, producedEvents, "accepted");
  }

  async reject(
    command: SuggestionCommandEnvelope<"suggestion.reject">,
  ): Promise<CommandOutcome> {
    ensureSuggestionsEnabled();

    const existing = await this.commandLog.getByIdempotencyKey(
      command.command_id,
    );
    if (existing) return existing;

    const artifact = await this.deps.artifactStore.getDerivedById(
      command.payload.suggestion_id,
    );
    if (!artifact || !isSuggestionArtifact(artifact)) {
      throw new PreconditionFailed("exists", "missing");
    }

    const status = await this.getStatus(command.payload.suggestion_id);
    if (status !== "new") {
      return this.finish(command, [], "already_processed", status);
    }

    const feedbackEvent = Feedback.buildFeedbackEvent({
      artifact_id: artifact.artifact_id,
      feedback_type: Feedback.FEEDBACK_TYPES.Rejected,
      correlation_id: command.correlation_id,
      causation_id: command.command_id,
      actor: command.actor,
      occurred_at: this.now(),
    });
    await this.deps.feedbackEventStore.append(feedbackEvent);

    return this.finish(command, [feedbackEvent.event_id], "accepted");
  }

  async snooze(
    command: SuggestionCommandEnvelope<"suggestion.snooze">,
  ): Promise<CommandOutcome> {
    ensureSuggestionsEnabled();

    const existing = await this.commandLog.getByIdempotencyKey(
      command.command_id,
    );
    if (existing) return existing;

    const artifact = await this.deps.artifactStore.getDerivedById(
      command.payload.suggestion_id,
    );
    if (!artifact || !isSuggestionArtifact(artifact)) {
      throw new PreconditionFailed("exists", "missing");
    }

    const status = await this.getStatus(command.payload.suggestion_id);
    if (status !== "new") {
      return this.finish(command, [], "already_processed", status);
    }

    const feedbackEvent = Feedback.buildFeedbackEvent({
      artifact_id: artifact.artifact_id,
      feedback_type: Feedback.FEEDBACK_TYPES.Snoozed,
      correlation_id: command.correlation_id,
      causation_id: command.command_id,
      actor: command.actor,
      occurred_at: this.now(),
    });
    await this.deps.feedbackEventStore.append(feedbackEvent);

    return this.finish(command, [feedbackEvent.event_id], "accepted");
  }

  private async getStatus(suggestionId: string): Promise<SuggestionStatus> {
    let last: EventEnvelope | null = null;
    for await (const event of this.deps.feedbackEventStore.stream()) {
      if (
        Feedback.isFeedbackEvent(event) &&
        event.payload.artifact_id === suggestionId
      ) {
        last = event;
      }
    }
    if (!last) return "new";

    switch (last.event_type) {
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

  private async executeDomainCommand(
    artifact: import("../artifacts/index.js").DerivedArtifact,
    actor: ActorRef,
  ): Promise<void> {
    if (!isSuggestionArtifact(artifact)) {
      throw new ValidationError("Unsupported suggestion artifact output");
    }
    const content = artifact.output_data as SuggestionContent;
    switch (artifact.output_type) {
      case suggestionOutputType("task_triage"):
        return this.runTaskTriage(content.diff, actor);
      case suggestionOutputType("note_hygiene"):
        return this.runNoteHygiene(content.diff, actor);
      default:
        // No-op suggestions fall back to no domain command.
        return;
    }
  }

  private async runTaskTriage(diff: unknown, actor: ActorRef): Promise<void> {
    if (!OPS_TASKS_ENABLED) {
      throw new ValidationError("Tasks are disabled (OPS_TASKS_ENABLED=0)");
    }
    const triage = diff as { task_id: string; to_bucket: Tasks.TaskBucket };
    const ledger = Tasks.createJsonlTaskLedger();
    const cmd: CommandEnvelope<
      Tasks.TaskCommandType,
      Tasks.TaskCommandPayload
    > = {
      command_id: Identity.generateCommandId({
        command_type: "task.triage",
        task_id: triage.task_id,
      }),
      command_type: "task.triage",
      payload: {
        task_id: triage.task_id,
        bucket: triage.to_bucket,
      },
      target_ref: `task:${triage.task_id}`,
      dedupe_scope: `task:${triage.task_id}`,
      correlation_id: Identity.randomId(),
      actor,
      requested_at: this.now(),
    };
    await ledger.execute(cmd);
  }

  private async runNoteHygiene(diff: unknown, actor: ActorRef): Promise<void> {
    if (!OPS_NOTES_ENABLED) {
      throw new ValidationError("Notes are disabled (OPS_NOTES_ENABLED=0)");
    }
    const payload = diff as { note_id: string; suggested_title: string };
    const ledger = Notes.createJsonlNoteLedger();
    const cmd: CommandEnvelope<
      Notes.NoteCommandType,
      Notes.NoteCommandPayload
    > = {
      command_id: Identity.generateCommandId({
        command_type: "note.update",
        note_id: payload.note_id,
      }),
      command_type: "note.update",
      payload: {
        note_id: payload.note_id,
        title: payload.suggested_title,
      },
      target_ref: `note:${payload.note_id}`,
      dedupe_scope: `note:${payload.note_id}`,
      correlation_id: Identity.randomId(),
      actor,
      requested_at: this.now(),
    };
    await ledger.execute(cmd);
  }

  private finish(
    command: CommandEnvelope,
    produced: string[],
    status: CommandOutcome["status"],
    reason?: string | SuggestionStatus,
  ): CommandOutcome {
    const outcome: CommandOutcome = {
      command_id: command.command_id,
      status,
      produced_events: produced,
      completed_at: this.now(),
      ...(reason ? { reason: String(reason) } : {}),
    };
    this.commandLog.recordOutcome(outcome).catch(() => {
      // non-blocking
    });
    return outcome;
  }
}

function ensureSuggestionsEnabled() {
  if (!OPS_SUGGESTIONS_ENABLED) {
    throw new ValidationError(
      "Suggestions are disabled (OPS_SUGGESTIONS_ENABLED=0)",
    );
  }
}
