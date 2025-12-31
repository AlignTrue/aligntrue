import { PlanClient, type PlanWithMetadata } from "./PlanClient";

export const runtime = "nodejs";

export default async function HomePage() {
  const plan = await fetchPlan();
  return <PlanClient initialPlan={plan} />;
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
