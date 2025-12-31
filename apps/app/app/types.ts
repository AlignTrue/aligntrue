import type { RenderPlan } from "@aligntrue/ui-contracts";

export type PlanWithMetadata = RenderPlan & {
  actor_id?: string;
  status?: "approved" | "pending_approval" | "rejected";
};
