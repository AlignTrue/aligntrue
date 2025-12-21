import { JsonlCommandLog, JsonlEventStore } from "../storage/index.js";
import { join } from "node:path";
import { OPS_DATA_DIR } from "../config.js";
import {
  TASK_EVENT_TYPES,
  TASKS_SCHEMA_VERSION,
  type TaskEvent,
  type TaskEventType,
} from "./events.js";
import { TaskLedger } from "./commands.js";

export {
  TASK_EVENT_TYPES,
  TASKS_SCHEMA_VERSION,
  TaskLedger,
  TaskEvent,
  TaskEventType,
};
export * from "./events.js";
export * from "./commands.js";
export * from "./state-machine.js";
export * from "./types.js";

export const DEFAULT_TASKS_EVENTS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-tasks.jsonl",
);

export function createJsonlTaskLedger(opts?: {
  eventsPath?: string;
  commandsPath?: string;
  outcomesPath?: string;
  now?: () => string;
}): TaskLedger {
  const eventStore = new JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_TASKS_EVENTS_PATH,
  );
  const commandLog = new JsonlCommandLog(
    opts?.commandsPath,
    opts?.outcomesPath,
  );
  const ledgerOpts = opts?.now ? { now: opts.now } : undefined;
  return new TaskLedger(eventStore, commandLog, ledgerOpts);
}
