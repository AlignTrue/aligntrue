"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageRenderer } from "@aligntrue/ui-renderer";
import { createPlatformRegistry } from "@aligntrue/ui-blocks/registry";
import { platformShell } from "@aligntrue/ui-blocks/ui/shell";
import type {
  ActionIntent,
  BlockAction,
  RenderPlan,
} from "@aligntrue/ui-contracts";
import type { PlanWithMetadata } from "./types";

export function PlanClient({
  initialPlan,
}: {
  initialPlan: PlanWithMetadata | null;
}) {
  const [plan, setPlan] = useState<PlanWithMetadata | null>(initialPlan);
  const [regenInFlight, setRegenInFlight] = useState(false);
  const [expectedStateVersion, setExpectedStateVersion] = useState(0);
  const [inFlightActions, setInFlightActions] = useState<Set<string>>(
    () => new Set(),
  );
  const registry = useMemo(() => createPlatformRegistry(), []);
  const sequenceKey = plan
    ? `aligntrue:sequence:${plan.actor_id ?? "anonymous"}:${plan.plan_id}`
    : "aligntrue:sequence:anon";

  const [clientSequence, setClientSequence] = useState(() => {
    if (typeof window === "undefined") return Date.now();
    const stored = localStorage.getItem(sequenceKey);
    return stored ? parseInt(stored, 10) : Date.now();
  });

  useEffect(() => {
    if (typeof window === "undefined" || !plan?.plan_id) return;
    const stored = localStorage.getItem(sequenceKey);
    if (stored) {
      setClientSequence(parseInt(stored, 10));
    }
  }, [plan?.plan_id, sequenceKey]);

  useEffect(() => {
    let cancelled = false;
    const loadStateVersion = async () => {
      if (!plan?.plan_id) return;
      const res = await fetch(`/api/ui/state?plan_id=${plan.plan_id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!cancelled) {
        setExpectedStateVersion(json.state?.version ?? 0);
      }
    };
    void loadStateVersion();
    return () => {
      cancelled = true;
    };
  }, [plan?.plan_id]);

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
        setExpectedStateVersion(0);
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

  const handleAction = useCallback(
    async (intent: ActionIntent) => {
      const key = intent.idempotency_key ?? crypto.randomUUID();
      if (inFlightActions.has(key)) return;

      const blockDef = plan.core.blocks.find(
        (b) => b.block_instance_id === intent.block_instance_id,
      );
      if (!blockDef) return;

      setInFlightActions((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      const nextSeq = clientSequence + 1;
      setClientSequence(nextSeq);
      localStorage.setItem(sequenceKey, String(nextSeq));

      const action: BlockAction & { expected_state_version: number } = {
        action_id: crypto.randomUUID(),
        idempotency_key: key,
        action_type: intent.action_type,
        block_instance_id: intent.block_instance_id,
        block_type: blockDef.block_type,
        payload: intent.payload,
        plan_id: plan.plan_id,
        client_sequence: nextSeq,
        correlation_id: crypto.randomUUID(),
        actor: { actor_id: actorId ?? "unknown", actor_type: "human" },
        expected_state_version: expectedStateVersion,
      };

      try {
        const res = await fetch("/api/ui/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const result = await res.json();

        if (result?.state_version !== undefined) {
          setExpectedStateVersion(result.state_version);
        }
        if (res.status === 409 && result?.latest_version !== undefined) {
          setExpectedStateVersion(result.latest_version);
        }
        if (result?.triggers?.plan_regen) {
          await triggerPlanRegen();
        }
      } finally {
        setInFlightActions((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [
      actorId,
      clientSequence,
      expectedStateVersion,
      inFlightActions,
      plan.core.blocks,
      plan.plan_id,
      sequenceKey,
      triggerPlanRegen,
    ],
  );

  return (
    <main className="p-4">
      <PageRenderer
        plan={plan as RenderPlan}
        registry={registry.blocks}
        shell={platformShell}
        onAction={handleAction}
        disabled={regenInFlight || inFlightActions.size > 0}
      />
    </main>
  );
}
