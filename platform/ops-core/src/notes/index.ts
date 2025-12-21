import { JsonlCommandLog, JsonlEventStore } from "../storage/index.js";
import {
  NOTE_EVENT_TYPES,
  NOTES_SCHEMA_VERSION,
  type NoteEvent,
  type NoteEventType,
} from "./events.js";
import { NoteLedger } from "./commands.js";

export {
  NOTE_EVENT_TYPES,
  NOTES_SCHEMA_VERSION,
  NoteLedger,
  NoteEvent,
  NoteEventType,
};
export * from "./events.js";
export * from "./commands.js";
export * from "./state-machine.js";
export * from "./markdown.js";

export const DEFAULT_NOTES_EVENTS_PATH = "./data/ops-core-notes.jsonl";

export function createJsonlNoteLedger(opts?: {
  eventsPath?: string;
  commandsPath?: string;
  outcomesPath?: string;
  now?: () => string;
}): NoteLedger {
  const eventStore = new JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_NOTES_EVENTS_PATH,
  );
  const commandLog = new JsonlCommandLog(
    opts?.commandsPath,
    opts?.outcomesPath,
  );
  const ledgerOpts = opts?.now ? { now: opts.now } : undefined;
  return new NoteLedger(eventStore, commandLog, ledgerOpts);
}
