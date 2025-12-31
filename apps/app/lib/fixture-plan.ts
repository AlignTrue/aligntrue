import type { RenderPlan } from "@aligntrue/ui-contracts";
import { createPlatformRegistry } from "@aligntrue/ui-blocks/registry";
import { getOrCreatePlanAndReceipt } from "./plan-service";
import { DEFAULT_POLICY } from "./default-policy";
import { buildUIContext } from "./ui-context";

export async function ensureFixturePlan(): Promise<{
  plan_id: string;
  plan: RenderPlan;
}> {
  const registry = createPlatformRegistry();
  const manifests = Array.from(registry.blocks.values()).map(
    (entry) => entry.manifest,
  );
  const allowed_manifest_hashes = new Set(
    manifests.map((m) => m.manifest_hash),
  );
  const allowed_block_types = new Set(manifests.map((m) => m.block_id));
  const context = await buildUIContext({ intent: "list", scope: "today" });

  const { plan, receipt } = getOrCreatePlanAndReceipt({
    context,
    policy: DEFAULT_POLICY,
    layoutIntentCore: undefined,
    mode: "deterministic",
    actor: { actor_id: "system", actor_type: "service" },
    workspace_id: undefined,
    causation_id: undefined,
    causation_type: undefined,
    ai_result: undefined,
    allowed_manifest_hashes,
    allowed_block_types,
    registry,
  });

  return { plan_id: receipt.plan_id, plan };
}
