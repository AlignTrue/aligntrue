import { Identity, Execution } from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommandEnvelope, createRuntime } from "./shared.js";

export async function attemptStep(args: string[]): Promise<void> {
  const run_id = args[0];
  if (!run_id) {
    exitWithError(2, "Usage: aligntrue run step <run_id> --kind <kind>");
    return;
  }
  const { kind, step_id } = parseArgs(args.slice(1));
  if (!kind) {
    exitWithError(2, "Missing --kind <kind>");
    return;
  }

  const runtime = createRuntime();
  const command = buildCommandEnvelope("step.attempt", {
    run_id,
    step_id: step_id ?? Identity.randomId(),
    kind,
  });

  const outcome = await runtime.execute(
    command as Execution.ExecutionCommandEnvelope,
  );
  if (outcome.status !== "accepted") {
    exitWithError(
      1,
      `Step attempt failed: ${outcome.reason ?? outcome.status}`,
    );
  }
  console.log(`Step attempted: ${command.payload.step_id} (run ${run_id})`);
}

function parseArgs(args: string[]): {
  kind: string | undefined;
  step_id: string | undefined;
} {
  let kind: string | undefined;
  let step_id: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--kind") {
      kind = args[i + 1];
      i++;
    } else if (arg === "--id") {
      step_id = args[i + 1];
      i++;
    }
  }
  return { kind, step_id };
}
