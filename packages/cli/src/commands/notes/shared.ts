import {
  OPS_CORE_ENABLED,
  OPS_NOTES_ENABLED,
  Identity,
  Storage,
  Notes,
  Projections,
} from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";

export const CLI_ACTOR: Notes.NoteCommandEnvelope["actor"] = {
  actor_id: process.env["USER"] || "cli-user",
  actor_type: "human",
  display_name: process.env["USER"] || "CLI User",
};

export function ensureNotesEnabled(): void {
  if (!OPS_CORE_ENABLED) {
    exitWithError(1, "ops-core is disabled", {
      hint: "Set OPS_CORE_ENABLED=1 to enable ops-core commands",
    });
  }
  if (!OPS_NOTES_ENABLED) {
    exitWithError(1, "Notes are disabled", {
      hint: "Set OPS_NOTES_ENABLED=1 to enable notes",
    });
  }
}

export function createLedger(): Notes.NoteLedger {
  const eventStore = new Storage.JsonlEventStore();
  const commandLog = new Storage.JsonlCommandLog();
  return new Notes.NoteLedger(eventStore, commandLog);
}

export function buildCommand<T extends Notes.NoteCommandType>(
  command_type: T,
  payload: Notes.NoteCommandPayload,
): Notes.NoteCommandEnvelope<T> {
  const target =
    "note_id" in payload
      ? `note:${(payload as { note_id: string }).note_id}`
      : "note:unknown";
  return {
    command_id: Identity.generateCommandId({ command_type, payload }),
    command_type,
    payload,
    target_ref: target,
    dedupe_scope: target,
    correlation_id: Identity.randomId(),
    actor: CLI_ACTOR,
    requested_at: new Date().toISOString(),
  } as Notes.NoteCommandEnvelope<T>;
}

export async function readNotesProjection() {
  const rebuilt = await Projections.rebuildOne(
    Projections.NotesProjectionDef,
    new Storage.JsonlEventStore(),
  );
  return Projections.buildNotesProjectionFromState(
    rebuilt.data as Projections.NotesProjectionState,
  );
}
