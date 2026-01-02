import { Projections } from "@aligntrue/core";
import { readRunsProjection } from "./shared.js";

export async function showRuns(args: string[]): Promise<void> {
  const filterId = args[0];
  const projection = await readRunsProjection();
  const runs = projection.runs.runs;
  const filtered = filterId
    ? runs.filter((r: Projections.RunSummary) => r.run_id === filterId)
    : runs;

  if (filtered.length === 0) {
    console.log("No runs found");
    return;
  }

  for (const run of filtered) {
    console.log(`Run ${run.run_id} [${run.status}]`);
    console.log(`  started_at: ${run.started_at}`);
    if (run.completed_at) console.log(`  completed_at: ${run.completed_at}`);
    if (run.steps.length === 0) {
      console.log("  steps: (none)");
    } else {
      for (const step of run.steps) {
        console.log(
          `  step ${step.step_id} kind=${step.kind} status=${step.status}` +
            (step.route ? ` route=${step.route}` : ""),
        );
      }
    }
  }
}
