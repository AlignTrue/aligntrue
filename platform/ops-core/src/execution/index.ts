import { JsonlCommandLog, JsonlEventStore } from "../storage/index.js";
import { ExecutionRuntime } from "./commands.js";
import { BudgetTracker } from "./budget.js";
import { join } from "node:path";
import { OPS_DATA_DIR } from "../config.js";

export * from "./types.js";
export * from "./events.js";
export * from "./commands.js";
export * from "./router.js";
export * from "./budget.js";
export * from "./state-machine.js";

export const DEFAULT_EXECUTION_EVENTS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-runs.jsonl",
);

export function createJsonlExecutionRuntime(opts?: {
  eventsPath?: string | undefined;
  commandsPath?: string | undefined;
  outcomesPath?: string | undefined;
  allowExternalPaths?: boolean | undefined;
  now?: (() => string) | undefined;
}): ExecutionRuntime {
  const eventStore = new JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_EXECUTION_EVENTS_PATH,
  );
  const commandLog = new JsonlCommandLog(
    opts?.commandsPath,
    opts?.outcomesPath,
    { allowExternalPaths: opts?.allowExternalPaths },
  );
  const budget = new BudgetTracker();
  return new ExecutionRuntime(eventStore, commandLog, {
    budget,
    ...(opts?.now ? { now: opts.now } : {}),
  });
}
