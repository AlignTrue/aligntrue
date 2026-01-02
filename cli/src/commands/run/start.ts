import { Identity, Execution } from "@aligntrue/core";
import { exitWithError } from "../../utils/command-utilities.js";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";
import { buildCommandEnvelope, createRuntime } from "./shared.js";

export async function startRun(args: string[]): Promise<void> {
  const spec: ArgDefinition[] = [
    { flag: "kind", type: "string", required: true },
    { flag: "id", type: "string" },
  ];

  const parsed = parseArgs(args, spec);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: "Usage: aligntrue run start --kind <kind> [--id <run_id>]",
    });
  }

  const kind = parsed.flags.kind as string;
  const run_id = parsed.flags.id as string | undefined;

  const runtime = createRuntime();
  const command = buildCommandEnvelope("run.start", {
    run_id: run_id ?? Identity.randomId(),
    target_ref: kind,
  });

  const outcome = await runtime.execute(
    command as Execution.ExecutionCommandEnvelope,
  );
  if (outcome.status !== "accepted") {
    exitWithError(1, `Run start failed: ${outcome.reason ?? outcome.status}`);
  }
  console.log(`Run started: ${command.payload.run_id}`);
}
