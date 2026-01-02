import { Identity, Execution } from "@aligntrue/core";
import { exitWithError } from "../../utils/command-utilities.js";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";
import { buildCommandEnvelope, createRuntime } from "./shared.js";

export async function attemptStep(args: string[]): Promise<void> {
  const spec: ArgDefinition[] = [
    { flag: "kind", type: "string", required: true },
    { flag: "id", type: "string" },
  ];

  const parsed = parseArgs(args, spec);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: "Usage: aligntrue run step <run_id> --kind <kind> [--id <step_id>]",
    });
  }

  const run_id = parsed.positional[0];
  if (!run_id) {
    exitWithError(2, "Run ID is required", {
      hint: "Usage: aligntrue run step <run_id> --kind <kind> [--id <step_id>]",
    });
  }

  const kind = parsed.flags.kind as string;
  const step_id = parsed.flags.id as string | undefined;

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
