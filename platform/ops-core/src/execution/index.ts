import { JsonlCommandLog, JsonlEventStore } from "../storage/index.js";
import { ExecutionRuntime } from "./commands.js";
import { BudgetTracker } from "./budget.js";

export * from "./types.js";
export * from "./events.js";
export * from "./commands.js";
export * from "./router.js";
export * from "./budget.js";
export * from "./state-machine.js";

export const DEFAULT_EXECUTION_EVENTS_PATH = "./data/ops-core-runs.jsonl";

export function createJsonlExecutionRuntime(opts?: {
  eventsPath?: string;
  commandsPath?: string;
  outcomesPath?: string;
  now?: () => string;
}): ExecutionRuntime {
  const eventStore = new JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_EXECUTION_EVENTS_PATH,
  );
  const commandLog = new JsonlCommandLog(
    opts?.commandsPath,
    opts?.outcomesPath,
  );
  const budget = new BudgetTracker();
  return new ExecutionRuntime(eventStore, commandLog, {
    budget,
    ...(opts?.now ? { now: opts.now } : {}),
  });
}
