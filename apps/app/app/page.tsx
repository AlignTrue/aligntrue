import { PlanClient } from "./PlanClient";
import type { PlanWithMetadata } from "./types";
import { getBaseUrl } from "@/lib/utils";

export const runtime = "nodejs";

export default async function HomePage() {
  const plan = await fetchPlan();
  return <PlanClient initialPlan={plan} />;
}

async function fetchPlan(): Promise<PlanWithMetadata | null> {
  const res = await fetch(`${getBaseUrl()}/api/ui/plan`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as PlanWithMetadata;
}
