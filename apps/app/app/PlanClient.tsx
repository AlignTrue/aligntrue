"use client";

import { useCallback, useMemo, useState } from "react";
import { PageRenderer } from "@aligntrue/ui-renderer";
import { createPlatformRegistry, platformShell } from "@aligntrue/ui-blocks";
import type { RenderPlan } from "@aligntrue/ui-contracts";
import { ActionTester } from "./ActionTester";

export type PlanWithMetadata = RenderPlan & {
  actor_id?: string;
  status?: "approved" | "pending_approval" | "rejected";
};

export function PlanClient({
  initialPlan,
}: {
  initialPlan: PlanWithMetadata | null;
}) {
  const [plan, setPlan] = useState<PlanWithMetadata | null>(initialPlan);
  const [regenInFlight, setRegenInFlight] = useState(false);
  const registry = useMemo(() => createPlatformRegistry(), []);

  const triggerPlanRegen = useCallback(async () => {
    if (regenInFlight) return;
    setRegenInFlight(true);
    try {
      const res = await fetch("/api/ui/plan?mode=ai", {
        cache: "no-store",
      });
      if (res.ok) {
        const next = (await res.json()) as PlanWithMetadata;
        setPlan(next);
      }
    } finally {
      setRegenInFlight(false);
    }
  }, [regenInFlight]);

  if (!plan) {
    return <div>Failed to load plan.</div>;
  }

  if ("status" in plan && plan.status !== "approved") {
    if (plan.status === "pending_approval") {
      return <div>Plan requires approval.</div>;
    }
    if (plan.status === "rejected") {
      return <div>Plan was rejected.</div>;
    }
  }

  const actorId = plan.actor_id;

  return (
    <main className="p-4">
      {actorId && plan?.plan_id ? (
        <ActionTester
          planId={plan.plan_id}
          actorId={actorId}
          onPlanRegen={triggerPlanRegen}
          regenInFlight={regenInFlight}
        />
      ) : null}
      <PageRenderer
        plan={plan as RenderPlan}
        registry={registry.blocks}
        shell={platformShell}
      />
    </main>
  );
}
