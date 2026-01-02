import {
  OPS_CORE_ENABLED,
  OPS_NOTES_ENABLED,
  Identity,
  Storage,
  Projections,
} from "@aligntrue/core";
import * as PackNotes from "@aligntrue/pack-notes";
import { exitWithError } from "../../utils/command-utilities.js";
import { CLI_ACTOR } from "../../utils/cli-actor.js";

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

export function createLedger(): PackNotes.NoteLedger {
  return PackNotes.createJsonlNoteLedger();
}

export function buildCommand<T extends PackNotes.NoteCommandType>(
  command_type: T,
  payload: PackNotes.NoteCommandPayload,
): PackNotes.NoteCommandEnvelope<T> {
  const target =
    "note_id" in payload
      ? `note:${(payload as { note_id: string }).note_id}`
      : "note:unknown";
  const idempotency_key = Identity.generateCommandId({ command_type, payload });
  return {
    command_id: Identity.randomId(),
    idempotency_key,
    command_type,
    payload,
    target_ref: target,
    dedupe_scope: "target",
    correlation_id: Identity.randomId(),
    actor: CLI_ACTOR,
    requested_at: new Date().toISOString(),
  } as PackNotes.NoteCommandEnvelope<T>;
}

export async function readNotesProjection() {
  const { projection } = await readNotesProjectionWithMeta();
  return projection;
}

export async function readNotesProjectionWithMeta() {
  const rebuilt = await Projections.rebuildOne(
    PackNotes.NotesProjectionDef,
    new Storage.JsonlEventStore(PackNotes.DEFAULT_NOTES_EVENTS_PATH),
  );
  const projection = PackNotes.buildNotesProjectionFromState(
    rebuilt.data as PackNotes.NotesProjectionState,
  );
  return {
    projection,
    hash: PackNotes.hashNotesProjection(projection),
    version: PackNotes.NotesProjectionDef.version,
  };
}
