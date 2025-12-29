import { JsonlCommandLog, JsonlEventStore } from "../storage/index.js";
import { join } from "node:path";
import { OPS_DATA_DIR } from "../config.js";
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

export const DEFAULT_NOTES_EVENTS_PATH = join(
  OPS_DATA_DIR,
  "ops-core-notes.jsonl",
);

export function createJsonlNoteLedger(opts?: {
  eventsPath?: string | undefined;
  commandsPath?: string | undefined;
  outcomesPath?: string | undefined;
  allowExternalPaths?: boolean | undefined;
  now?: (() => string) | undefined;
}): NoteLedger {
  const eventStore = new JsonlEventStore(
    opts?.eventsPath ?? DEFAULT_NOTES_EVENTS_PATH,
  );
  const commandLog = new JsonlCommandLog(
    opts?.commandsPath ?? join(OPS_DATA_DIR, "ops-core-notes-commands.jsonl"),
    opts?.outcomesPath ?? join(OPS_DATA_DIR, "ops-core-notes-outcomes.jsonl"),
    { allowExternalPaths: opts?.allowExternalPaths },
  );
  const ledgerOpts = opts?.now ? { now: opts.now } : undefined;
  return new NoteLedger(eventStore, commandLog, ledgerOpts);
}
