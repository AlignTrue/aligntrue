import {
  Contracts,
  type CommandEnvelope,
  type PackCommandHandler,
} from "@aligntrue/ops-core";
import { SuggestionExecutor } from "./executor.js";
import { buildAndStoreDailyPlan, type DailyPlanData } from "./daily-plan.js";
import { buildWeeklyPlan } from "./weekly-plan.js";
import { buildSuggestionGeneratedEvent } from "./events.js";
import {
  type ApproveSuggestionPayload,
  type BuildDailyPlanPayload,
  type BuildWeeklyPlanPayload,
  type RejectSuggestionPayload,
  type SnoozeSuggestionPayload,
} from "./commands.js";
import {
  createArtifactStore,
  createFeedbackEventStore,
  createSuggestionEventStore,
} from "./storage.js";

export const commandHandlers: Record<string, PackCommandHandler> = {
  [Contracts.SUGGESTION_COMMAND_TYPES.Approve]: (async (command, context) => {
    const executor = new SuggestionExecutor(
      {
        artifactStore: createArtifactStore(),
        feedbackEventStore: createFeedbackEventStore(),
        suggestionEventStore: createSuggestionEventStore(),
      },
      context,
    );
    return executor.approve(
      command as CommandEnvelope<
        typeof Contracts.SUGGESTION_COMMAND_TYPES.Approve,
        ApproveSuggestionPayload
      >,
    );
  }) as PackCommandHandler,

  [Contracts.SUGGESTION_COMMAND_TYPES.Reject]: (async (command, context) => {
    const executor = new SuggestionExecutor(
      {
        artifactStore: createArtifactStore(),
        feedbackEventStore: createFeedbackEventStore(),
        suggestionEventStore: createSuggestionEventStore(),
      },
      context,
    );
    return executor.reject(
      command as CommandEnvelope<
        typeof Contracts.SUGGESTION_COMMAND_TYPES.Reject,
        RejectSuggestionPayload
      >,
    );
  }) as PackCommandHandler,

  [Contracts.SUGGESTION_COMMAND_TYPES.Snooze]: (async (command, context) => {
    const executor = new SuggestionExecutor(
      {
        artifactStore: createArtifactStore(),
        feedbackEventStore: createFeedbackEventStore(),
        suggestionEventStore: createSuggestionEventStore(),
      },
      context,
    );
    return executor.snooze(
      command as CommandEnvelope<
        typeof Contracts.SUGGESTION_COMMAND_TYPES.Snooze,
        SnoozeSuggestionPayload
      >,
    );
  }) as PackCommandHandler,

  [Contracts.SUGGESTION_COMMAND_TYPES.BuildDailyPlan]: (async (
    command,
    _context,
  ) => {
    const artifactStore = createArtifactStore();
    const correlation_id = command.correlation_id ?? command.command_id;
    const payload = command.payload as BuildDailyPlanPayload;
    const artifact = await buildAndStoreDailyPlan({
      task_ids: payload.task_ids,
      date: payload.date,
      tasks_projection_hash: payload.tasks_projection_hash,
      actor: command.actor,
      artifactStore,
      correlation_id,
      auto_generated: false,
    });

    const generated = buildSuggestionGeneratedEvent({
      suggestion_id: artifact.artifact_id,
      suggestion_type: "task_triage",
      target_refs: (artifact.output_data as DailyPlanData).task_ids.map(
        (id: string) => `task:${id}`,
      ),
      correlation_id,
      actor: command.actor,
      occurred_at: artifact.created_at,
    });
    await createSuggestionEventStore().append(generated);

    return {
      command_id: command.command_id,
      status: "accepted",
      produced_events: [generated.event_id],
    };
  }) as PackCommandHandler,

  [Contracts.SUGGESTION_COMMAND_TYPES.BuildWeeklyPlan]: (async (
    command,
    _context,
  ) => {
    const artifactStore = createArtifactStore();
    const correlation_id = command.correlation_id ?? command.command_id;
    const payload = command.payload as BuildWeeklyPlanPayload;
    const result = await buildWeeklyPlan({
      actor: command.actor,
      artifactStore,
      tasksProjection: payload.tasks_projection,
      tasksProjectionHash: payload.tasks_projection_hash,
      correlation_id,
      ...(payload.force !== undefined ? { force: payload.force } : {}),
      ...(payload.week_start !== undefined
        ? { week_start: payload.week_start }
        : {}),
    });

    if (result.artifact) {
      const generated = buildSuggestionGeneratedEvent({
        suggestion_id: result.artifact.artifact_id,
        suggestion_type: "task_triage",
        target_refs:
          (result.artifact.output_data as { task_refs?: string[] })
            ?.task_refs ?? [],
        correlation_id,
        actor: command.actor,
        occurred_at: result.artifact.created_at,
      });
      await createSuggestionEventStore().append(generated);
      return {
        command_id: command.command_id,
        status: "accepted",
        produced_events: [generated.event_id],
      };
    }

    return {
      command_id: command.command_id,
      status: result.outcome === "unchanged" ? "already_processed" : "rejected",
      reason: result.reason,
    };
  }) as PackCommandHandler,
};
