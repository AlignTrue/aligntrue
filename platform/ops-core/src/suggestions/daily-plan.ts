import * as Artifacts from "../artifacts/index.js";
import type { ActorRef } from "../envelopes/actor.js";
import { ValidationError } from "../errors.js";
import type { ArtifactStore } from "../storage/interfaces.js";

export interface DailyPlanData {
  readonly date: string; // YYYY-MM-DD
  readonly task_ids: string[];
  readonly auto_generated: boolean;
}

export interface DailyPlanInput {
  readonly task_ids: string[];
  readonly date: string;
  readonly auto_generated?: boolean;
  readonly tasks_projection_hash: string;
  readonly actor: ActorRef;
  readonly artifactStore: ArtifactStore<
    Artifacts.QueryArtifact,
    Artifacts.DerivedArtifact
  >;
  readonly correlation_id: string;
  readonly policy_version?: string;
  readonly created_at?: string;
}

export async function buildAndStoreDailyPlan(
  input: DailyPlanInput,
): Promise<Artifacts.DerivedArtifact> {
  if (input.task_ids.length === 0) {
    throw new ValidationError("Daily plan requires at least one task id");
  }
  if (input.task_ids.length > 3) {
    throw new ValidationError("Daily plan supports up to 3 task ids");
  }

  const created_at = input.created_at ?? new Date().toISOString();
  const policy_version = input.policy_version ?? "suggestions@0.0.1";

  const query = Artifacts.buildQueryArtifact({
    referenced_entities: ["task"],
    referenced_fields: ["id"],
    filters: { plan_date: input.date },
    created_at,
    created_by: input.actor,
    correlation_id: input.correlation_id,
  });
  await input.artifactStore.putQueryArtifact(query);

  const output_data: DailyPlanData = {
    date: input.date,
    task_ids: input.task_ids,
    auto_generated: input.auto_generated ?? false,
  };

  const derived = Artifacts.buildDerivedArtifact({
    input_query_ids: [query.artifact_id],
    input_hashes: [query.content_hash, input.tasks_projection_hash],
    policy_version,
    output_type: "daily_plan",
    output_data,
    created_at,
    created_by: input.actor,
    correlation_id: input.correlation_id,
  });

  await input.artifactStore.putDerivedArtifact(derived);
  return derived;
}
