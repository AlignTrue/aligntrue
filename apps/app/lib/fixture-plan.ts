import type { RenderPlan, PlanCore } from "@aligntrue/ui-contracts";
import { computePlanId } from "@aligntrue/ui-contracts";
import {
  entityTableManifest,
  statusIndicatorManifest,
} from "@aligntrue/ui-blocks";
import { upsertPlan } from "./db";

const FIXTURE_PLAN_ID = "fixture-plan-1";

export function ensureFixturePlan(): { plan_id: string; plan: RenderPlan } {
  const core: PlanCore = {
    layout_template: "single",
    input_refs: [],
    policy_version: "ui@0.0.1",
    blocks: [
      {
        block_id: entityTableManifest.block_id,
        block_version: entityTableManifest.version,
        manifest_hash: entityTableManifest.manifest_hash,
        slot: "main",
        props: {
          title: "Fixture Entities",
          items: [
            { id: "1", label: "Alice Example", email: "alice@example.com" },
            { id: "2", label: "Bob Example", email: "bob@example.com" },
          ],
        },
      },
      {
        block_id: statusIndicatorManifest.block_id,
        block_version: statusIndicatorManifest.version,
        manifest_hash: statusIndicatorManifest.manifest_hash,
        slot: "main",
        props: { label: "Fixture Plan", state: "ok" },
      },
    ],
  };

  const plan_id = computePlanId(core);
  const created_at = new Date().toISOString();
  const plan: RenderPlan = {
    plan_id,
    core,
    meta: {
      request_id: FIXTURE_PLAN_ID,
      actor: { actor_id: "system", actor_type: "service" },
      correlation_id: FIXTURE_PLAN_ID,
      created_at,
    },
  };

  upsertPlan({
    plan_id,
    core: plan.core,
    meta: plan.meta,
    status: "approved",
    created_at,
  });

  return { plan_id, plan };
}
