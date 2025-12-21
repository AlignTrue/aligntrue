import { JsonlCommandLog, JsonlEventStore } from "../storage/index.js";
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

export function createJsonlTaskLedger(opts?: {
  eventsPath?: string;
  commandsPath?: string;
  outcomesPath?: string;
  now?: () => string;
}): TaskLedger {
  const eventStore = new JsonlEventStore(opts?.eventsPath);
  const commandLog = new JsonlCommandLog(
    opts?.commandsPath,
    opts?.outcomesPath,
  );
  const ledgerOpts = opts?.now ? { now: opts.now } : undefined;
  return new TaskLedger(eventStore, commandLog, ledgerOpts);
}
