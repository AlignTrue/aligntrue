import {
  Contracts,
  Identity,
  Feedback,
  Artifacts,
  type CommandEnvelope,
  type CommandOutcome,
  type ActorRef,
  type PackContext,
  type EventEnvelope,
  type ArtifactStore,
  type EventStore,
} from "@aligntrue/core";
import { ensureSuggestionsEnabled } from "./utils.js";
import {
  isSuggestionArtifact,
  suggestionOutputType,
  type SuggestionContent,
  type SuggestionStatus,
} from "./types.js";

import {
  ApproveSuggestionPayload,
  RejectSuggestionPayload,
  SnoozeSuggestionPayload,
  SuggestionCommandPayload,
} from "./commands.js";

export interface SuggestionExecutorDeps {
  readonly artifactStore: ArtifactStore<
    Artifacts.QueryArtifact,
    Artifacts.DerivedArtifact
  >;
  readonly feedbackEventStore: EventStore;
  readonly suggestionEventStore?: EventStore | undefined;
  readonly now?: (() => string) | undefined;
}

export class SuggestionExecutor {
  private readonly now: () => string;

  constructor(
    private readonly deps: SuggestionExecutorDeps,
    private readonly context: PackContext,
  ) {
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  async approve(
    command: CommandEnvelope<
      (typeof Contracts.SUGGESTION_COMMAND_TYPES)["Approve"],
      SuggestionCommandPayload
    >,
  ): Promise<CommandOutcome> {
    ensureSuggestionsEnabled();
    const payload = command.payload as ApproveSuggestionPayload & {
      expected_hash: string;
    };

    const artifact = await this.deps.artifactStore.getDerivedById(
      payload.suggestion_id,
    );
    if (!artifact || !isSuggestionArtifact(artifact)) {
      return {
        command_id: command.command_id,
        status: "failed",
        reason: "Suggestion artifact not found",
      };
    }

    const status = await this.getStatus(payload.suggestion_id);
    if (status !== "new") {
      if (artifact.content_hash !== payload.expected_hash) {
        return {
          command_id: command.command_id,
          status: "failed",
          reason: "Hash mismatch",
        };
      }
      return {
        command_id: command.command_id,
        status: "already_processed",
        reason: status,
      };
    }

    if (artifact.content_hash !== payload.expected_hash) {
      return {
        command_id: command.command_id,
        status: "failed",
        reason: "Hash mismatch",
      };
    }

    const producedEvents: string[] = [];
    const childOutcome = await this.executeDomainCommand(
      artifact,
      command.actor,
      command.command_id,
    );
    if (childOutcome.child_commands?.length) {
      // bubble child commands into outcome
    }

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

    return {
      command_id: command.command_id,
      status: "accepted",
      produced_events: producedEvents,
      ...(childOutcome.child_commands?.length
        ? { child_commands: childOutcome.child_commands }
        : {}),
    };
  }

  async reject(
    command: CommandEnvelope<
      (typeof Contracts.SUGGESTION_COMMAND_TYPES)["Reject"],
      SuggestionCommandPayload
    >,
  ): Promise<CommandOutcome> {
    ensureSuggestionsEnabled();
    const payload = command.payload as RejectSuggestionPayload;

    const artifact = await this.deps.artifactStore.getDerivedById(
      payload.suggestion_id,
    );
    if (!artifact || !isSuggestionArtifact(artifact)) {
      return {
        command_id: command.command_id,
        status: "failed",
        reason: "Suggestion artifact not found",
      };
    }

    const status = await this.getStatus(payload.suggestion_id);
    if (status !== "new") {
      return {
        command_id: command.command_id,
        status: "already_processed",
        reason: status,
      };
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

    return {
      command_id: command.command_id,
      status: "accepted",
      produced_events: [feedbackEvent.event_id],
    };
  }

  async snooze(
    command: CommandEnvelope<
      (typeof Contracts.SUGGESTION_COMMAND_TYPES)["Snooze"],
      SuggestionCommandPayload
    >,
  ): Promise<CommandOutcome> {
    ensureSuggestionsEnabled();
    const payload = command.payload as SnoozeSuggestionPayload;

    const artifact = await this.deps.artifactStore.getDerivedById(
      payload.suggestion_id,
    );
    if (!artifact || !isSuggestionArtifact(artifact)) {
      return {
        command_id: command.command_id,
        status: "failed",
        reason: "Suggestion artifact not found",
      };
    }

    const status = await this.getStatus(payload.suggestion_id);
    if (status !== "new") {
      return {
        command_id: command.command_id,
        status: "already_processed",
        reason: status,
      };
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

    return {
      command_id: command.command_id,
      status: "accepted",
      produced_events: [feedbackEvent.event_id],
    };
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
    artifact: Artifacts.DerivedArtifact,
    actor: ActorRef,
    parentCommandId: string,
  ): Promise<CommandOutcome> {
    if (!isSuggestionArtifact(artifact)) {
      return {
        command_id: parentCommandId,
        status: "failed",
        reason: "Unsupported artifact",
      };
    }
    const content = artifact.output_data as SuggestionContent;
    switch (artifact.output_type) {
      case suggestionOutputType("task_triage"):
        return this.runTaskTriage(content.diff, actor);
      case suggestionOutputType("note_hygiene"):
        return this.runNoteHygiene(content.diff, actor);
      default:
        return { command_id: parentCommandId, status: "accepted" };
    }
  }

  private async runTaskTriage(
    diff: unknown,
    _actor: ActorRef,
  ): Promise<CommandOutcome> {
    const triage = diff as { task_id: string; to_bucket: Contracts.TaskBucket };
    const idempotency_key = Identity.generateCommandId({
      command_type: Contracts.TASK_COMMAND_TYPES.Triage,
      task_id: triage.task_id,
    });
    return this.context.dispatchChild({
      command_type: Contracts.TASK_COMMAND_TYPES.Triage,
      payload: {
        task_id: triage.task_id,
        bucket: triage.to_bucket,
      },
      target_ref: `task:${triage.task_id}`,
      dedupe_scope: "target",
      idempotency_key,
      capability_id: Contracts.TASK_COMMAND_TYPES.Triage,
    });
  }

  private async runNoteHygiene(
    diff: unknown,
    _actor: ActorRef,
  ): Promise<CommandOutcome> {
    const payload = diff as { note_id: string; suggested_title: string };
    const idempotency_key = Identity.generateCommandId({
      command_type: Contracts.NOTE_COMMAND_TYPES.Update,
      note_id: payload.note_id,
    });
    return this.context.dispatchChild({
      command_type: Contracts.NOTE_COMMAND_TYPES.Update,
      payload: {
        note_id: payload.note_id,
        title: payload.suggested_title,
      },
      target_ref: `note:${payload.note_id}`,
      dedupe_scope: "target",
      idempotency_key,
      capability_id: Contracts.NOTE_COMMAND_TYPES.Update,
    });
  }
}
