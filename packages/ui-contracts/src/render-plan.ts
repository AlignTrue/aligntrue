import type { ActorRef } from "@aligntrue/ops-core";
import type { PlanCore } from "./plan-core.js";

export interface PlanMeta {
  readonly request_id: string;
  readonly actor: ActorRef;
  readonly capability_id?: string;
  readonly correlation_id: string;
  readonly created_at: string;
  readonly approved_at?: string;
  readonly approved_by?: ActorRef;
}

export interface RenderPlan {
  readonly plan_id: string; // = hash(canonical(PlanCore))
  readonly core: PlanCore;
  readonly meta: PlanMeta;
}
