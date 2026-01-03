import { notFound } from "next/navigation";
import { OPS_TRAJECTORIES_ENABLED } from "@aligntrue/core";

import { ComparisonView } from "./ComparisonView";

export const runtime = "nodejs";

export default function ComparePage() {
  if (!OPS_TRAJECTORIES_ENABLED) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Forked Futures</h1>
      <ComparisonView />
    </div>
  );
}
