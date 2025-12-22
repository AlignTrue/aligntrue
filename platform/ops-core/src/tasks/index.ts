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
  const eventsPath =
    opts?.eventsPath ??
    process.env["OPS_TASKS_EVENTS_PATH"] ??
    DEFAULT_TASKS_EVENTS_PATH;
  const commandsPath =
    opts?.commandsPath ?? process.env["OPS_TASKS_COMMANDS_PATH"];
  const outcomesPath =
    opts?.outcomesPath ?? process.env["OPS_TASKS_OUTCOMES_PATH"];

  const eventStore = new JsonlEventStore(eventsPath);
  const commandLog = new JsonlCommandLog(commandsPath, outcomesPath);
  const ledgerOpts = opts?.now ? { now: opts.now } : undefined;
  return new TaskLedger(eventStore, commandLog, ledgerOpts);
}
