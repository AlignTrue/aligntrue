import type { CapabilityGrant } from "@aligntrue/ops-core";
import type { PlanCore } from "@aligntrue/ui-contracts";
import type { BlockManifest, BlockActionSchema } from "@aligntrue/ui-contracts";

export interface PolicyContext {
  readonly actor: { actor_id: string; actor_type: string };
  readonly capabilities: CapabilityGrant[];
  readonly plan: PlanCore;
  readonly manifests: Map<string, BlockManifest>;
}

export interface PolicyReason {
  readonly rule_id: string;
  readonly severity: "block" | "approval_required" | "warn";
  readonly message: string;
}

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly requires_approval: boolean;
  readonly reasons: PolicyReason[];
}

export function evaluatePlan(ctx: PolicyContext): PolicyDecision {
  const reasons: PolicyReason[] = [];

  for (const block of ctx.plan.blocks) {
    const manifest = ctx.manifests.get(block.block_id);
    if (!manifest) {
      reasons.push({
        rule_id: "manifest.missing",
        severity: "block",
        message: `Manifest not found for block ${block.block_id}`,
      });
      continue;
    }

    if (!hasCapability(ctx.capabilities, manifest.required_capability)) {
      reasons.push({
        rule_id: "capability.block.missing",
        severity: "block",
        message: `Actor lacks ${manifest.required_capability} for ${block.block_id}`,
      });
    }

    for (const action of manifest.actions ?? []) {
      evaluateActionCapability(
        action,
        ctx.capabilities,
        block.block_id,
        reasons,
      );
    }
  }

  return aggregateReasons(reasons);
}

function evaluateActionCapability(
  action: BlockActionSchema,
  capabilities: CapabilityGrant[],
  blockId: string,
  reasons: PolicyReason[],
): void {
  if (!action.required_capability) return;
  if (hasCapability(capabilities, action.required_capability)) return;

  const severity =
    action.safety_class === "WRITE_EXTERNAL_SIDE_EFFECT"
      ? "approval_required"
      : "block";

  reasons.push({
    rule_id: "capability.action.missing",
    severity,
    message: `Actor lacks ${action.required_capability} for action ${action.action_type} (block ${blockId})`,
  });
}

function aggregateReasons(reasons: PolicyReason[]): PolicyDecision {
  const blocked = reasons.some((r) => r.severity === "block");
  const requiresApproval =
    !blocked && reasons.some((r) => r.severity === "approval_required");
  return {
    allowed: !blocked,
    requires_approval: requiresApproval,
    reasons,
  };
}

function hasCapability(
  grants: CapabilityGrant[],
  required: string | undefined,
): boolean {
  if (!required) return true;
  return grants.some((grant) => grant.scope.includes(required));
}
