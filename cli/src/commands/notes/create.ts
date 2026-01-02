import { Identity } from "@aligntrue/core";
import * as PackNotes from "@aligntrue/pack-notes";
import { exitWithError } from "../../utils/command-utilities.js";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";
import { buildCommand, createLedger, ensureNotesEnabled } from "./shared.js";

export async function createNote(args: string[]): Promise<void> {
  ensureNotesEnabled();

  const spec: ArgDefinition[] = [
    { flag: "id", type: "string" },
    { flag: "body", type: "string" },
  ];

  const parsed = parseArgs(args, spec);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: 'Usage: aligntrue note create <title> [--id <id>] [--body "text"]',
    });
  }

  const title = parsed.positional[0];
  if (!title) {
    exitWithError(2, "Title is required", {
      hint: 'Usage: aligntrue note create <title> [--id <id>] [--body "text"]',
    });
  }

  const note_id: string =
    (parsed.flags.id as string | undefined) ?? Identity.deterministicId(title);
  const body_md = (parsed.flags.body as string | undefined) ?? "";
  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand(PackNotes.NOTE_COMMAND_TYPES.Create, {
      note_id,
      title,
      body_md,
      content_hash: Identity.hashCanonical(body_md),
    }),
  );

  console.log(
    `Note ${note_id} created (${outcome.status}, events: ${outcome.produced_events?.length ?? 0})`,
  );
}
