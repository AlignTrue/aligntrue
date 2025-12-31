import { PageRenderer } from "@aligntrue/ui-renderer";
import { createPlatformRegistry, platformShell } from "@aligntrue/ui-blocks";
import type { RenderPlan } from "@aligntrue/ui-contracts";
import { ActionTester } from "./ActionTester";

export const runtime = "nodejs";

type PlanWithMetadata = RenderPlan & {
  actor_id?: string;
  status?: "approved" | "pending_approval" | "rejected";
};

export default async function HomePage() {
  const plan = await fetchPlan();
  const platformRegistry = createPlatformRegistry();

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
        <ActionTester planId={plan.plan_id} actorId={actorId} />
      ) : null}
      <PageRenderer
        plan={plan as RenderPlan}
        registry={platformRegistry.blocks}
        shell={platformShell}
      />
    </main>
  );
}

async function fetchPlan(): Promise<PlanWithMetadata | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/ui/plan`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as PlanWithMetadata;
}
