import {
  Contracts,
  type PackContext,
  defineCommandHandlers,
} from "@aligntrue/core";
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
import { type SuggestionStores } from "./storage.js";

type SuggestionCommandPayloadMap = {
  [Contracts.SUGGESTION_COMMAND_TYPES.Approve]: ApproveSuggestionPayload;
  [Contracts.SUGGESTION_COMMAND_TYPES.Reject]: RejectSuggestionPayload;
  [Contracts.SUGGESTION_COMMAND_TYPES.Snooze]: SnoozeSuggestionPayload;
  [Contracts.SUGGESTION_COMMAND_TYPES.BuildDailyPlan]: BuildDailyPlanPayload;
  [Contracts.SUGGESTION_COMMAND_TYPES.BuildWeeklyPlan]: BuildWeeklyPlanPayload;
};

function getSuggestionStores(context: PackContext): Required<SuggestionStores> {
  const { artifactStore, feedbackEventStore, suggestionEventStore } = context;
  if (!artifactStore || !feedbackEventStore || !suggestionEventStore) {
    throw new Error("Suggestion stores not available in pack context");
  }
  return {
    artifactStore: artifactStore as Required<SuggestionStores>["artifactStore"],
    feedbackEventStore,
    suggestionEventStore,
  };
}

export const commandHandlers =
  defineCommandHandlers<SuggestionCommandPayloadMap>({
    [Contracts.SUGGESTION_COMMAND_TYPES.Approve]: async (command, context) => {
      const stores = getSuggestionStores(context);
      const executor = new SuggestionExecutor(
        {
          artifactStore: stores.artifactStore,
          feedbackEventStore: stores.feedbackEventStore,
          suggestionEventStore: stores.suggestionEventStore,
        },
        context,
      );
      return executor.approve(command);
    },

    [Contracts.SUGGESTION_COMMAND_TYPES.Reject]: async (command, context) => {
      const stores = getSuggestionStores(context);
      const executor = new SuggestionExecutor(
        {
          artifactStore: stores.artifactStore,
          feedbackEventStore: stores.feedbackEventStore,
          suggestionEventStore: stores.suggestionEventStore,
        },
        context,
      );
      return executor.reject(command);
    },

    [Contracts.SUGGESTION_COMMAND_TYPES.Snooze]: async (command, context) => {
      const stores = getSuggestionStores(context);
      const executor = new SuggestionExecutor(
        {
          artifactStore: stores.artifactStore,
          feedbackEventStore: stores.feedbackEventStore,
          suggestionEventStore: stores.suggestionEventStore,
        },
        context,
      );
      return executor.snooze(command);
    },

    [Contracts.SUGGESTION_COMMAND_TYPES.BuildDailyPlan]: async (
      command,
      context,
    ) => {
      const { artifactStore, suggestionEventStore } =
        getSuggestionStores(context);
      const correlation_id = command.correlation_id ?? command.command_id;
      const payload = command.payload;
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
      await suggestionEventStore.append(generated);

      return {
        command_id: command.command_id,
        status: "accepted",
        produced_events: [generated.event_id],
      };
    },

    [Contracts.SUGGESTION_COMMAND_TYPES.BuildWeeklyPlan]: async (
      command,
      context,
    ) => {
      const { artifactStore, suggestionEventStore } =
        getSuggestionStores(context);
      const correlation_id = command.correlation_id ?? command.command_id;
      const payload = command.payload;
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
        await suggestionEventStore.append(generated);
        return {
          command_id: command.command_id,
          status: "accepted",
          produced_events: [generated.event_id],
        };
      }

      return {
        command_id: command.command_id,
        status:
          result.outcome === "unchanged" ? "already_processed" : "rejected",
        ...(result.reason ? { reason: result.reason } : {}),
      };
    },
  });
