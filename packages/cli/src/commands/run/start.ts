import { Identity, Execution } from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommandEnvelope, createRuntime } from "./shared.js";

export async function startRun(args: string[]): Promise<void> {
  const { kind, run_id } = parseArgs(args);
  if (!kind) {
    exitWithError(2, "Missing --kind <kind>");
    return;
  }

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

function parseArgs(args: string[]): {
  kind: string | undefined;
  run_id: string | undefined;
} {
  let kind: string | undefined;
  let run_id: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--kind") {
      kind = args[i + 1];
      i++;
    } else if (arg === "--id") {
      run_id = args[i + 1];
      i++;
    }
  }
  return { kind, run_id };
}
