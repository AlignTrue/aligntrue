import { OPS_NOTES_ENABLED, Identity } from "@aligntrue/core";
import * as PackNotes from "@aligntrue/pack-notes";
import { createPackHost } from "../../utils/pack-host.js";
import { CLI_ACTOR } from "../../utils/cli-actor.js";

const packHost = createPackHost<
  PackNotes.NotesProjectionState,
  PackNotes.NotesProjection
>({
  pack: {
    name: "@aligntrue/pack-notes",
    version: "0.0.1",
    source: "workspace",
  },
  capabilities: Object.values(PackNotes.NOTE_COMMAND_TYPES),
  domainEnabled: OPS_NOTES_ENABLED,
  domainName: "notes",
  projection: {
    def: PackNotes.NotesProjectionDef,
    build: PackNotes.buildNotesProjectionFromState,
    hash: PackNotes.hashNotesProjection,
  },
});

export const ensureNotesEnabled = packHost.ensureEnabled;

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
  const { projection, hash, version } = await packHost.readProjection();
  return {
    projection,
    hash: hash ?? PackNotes.hashNotesProjection(projection),
    version: version ?? PackNotes.NotesProjectionDef.version,
  };
}
