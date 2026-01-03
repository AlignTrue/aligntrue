import { notFound } from "next/navigation";
import { OPS_TRAJECTORIES_ENABLED } from "@aligntrue/core";

import { SimulationForm } from "./SimulationForm";

export const runtime = "nodejs";

export default function SimulationPage() {
  if (!OPS_TRAJECTORIES_ENABLED) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Simulation Explorer</h1>
      <SimulationForm />
    </div>
  );
}
