import type { CommandEnvelope, ActorRef } from "@aligntrue/ops-core";
import { Contracts, Identity } from "@aligntrue/ops-core";
import type { WeeklyTasksProjection } from "./weekly-plan.js";

export type SuggestionCommandEnvelope<
  T extends Contracts.SuggestionCommandType = Contracts.SuggestionCommandType,
> = CommandEnvelope<T, SuggestionCommandPayload>;

export type SuggestionCommandPayload =
  | ApproveSuggestionPayload
  | RejectSuggestionPayload
  | SnoozeSuggestionPayload
  | BuildDailyPlanPayload
  | BuildWeeklyPlanPayload;

export interface ApproveSuggestionPayload {
  readonly suggestion_id: string;
  readonly expected_hash: string;
}

export interface RejectSuggestionPayload {
  readonly suggestion_id: string;
}

export interface SnoozeSuggestionPayload {
  readonly suggestion_id: string;
}

export interface BuildDailyPlanPayload {
  readonly task_ids: string[];
  readonly date: string;
  readonly tasks_projection_hash: string;
}

export interface BuildWeeklyPlanPayload {
  readonly week_start?: string;
  readonly force?: boolean;
  readonly tasks_projection: WeeklyTasksProjection;
  readonly tasks_projection_hash: string;
}

export function buildSuggestionCommand<
  T extends Contracts.SuggestionCommandType,
>(
  command_type: T,
  payload: SuggestionCommandPayload,
  actor: ActorRef,
): SuggestionCommandEnvelope<T> {
  const target = `suggestion:${"suggestion_id" in payload ? payload.suggestion_id : "unknown"}`;
  const command_id = Identity.randomId();
  const idempotency_key =
    command_type === Contracts.SUGGESTION_COMMAND_TYPES.BuildWeeklyPlan
      ? Identity.deterministicId({
          command_type,
          correlation_id: command_id,
          scope: "weekly_plan",
        })
      : command_id;
  return {
    command_id,
    idempotency_key,
    command_type,
    payload,
    target_ref: target,
    dedupe_scope: "target",
    correlation_id: command_id,
    actor,
    requested_at: new Date().toISOString(),
  } as SuggestionCommandEnvelope<T>;
}
