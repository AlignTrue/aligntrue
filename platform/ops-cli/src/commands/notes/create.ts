import { Identity } from "@aligntrue/ops-core";
import * as PackNotes from "@aligntrue/pack-notes";
import { exitWithError } from "../../utils/command-utilities.js";
import { buildCommand, createLedger, ensureNotesEnabled } from "./shared.js";

export async function createNote(args: string[]): Promise<void> {
  ensureNotesEnabled();
  let customId: string | undefined;
  let body_md = "";
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args.at(i);
    if (!arg) continue;
    if (arg === "--id") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--id requires a value", {
          hint: 'Usage: aligntrue note create <title> [--id <id>] [--body "text"]',
        });
      }
      customId = next;
      i += 1;
      continue;
    }
    if (arg === "--body") {
      const next = args.at(i + 1);
      if (!next) {
        exitWithError(2, "--body requires a value", {
          hint: 'Usage: aligntrue note create <title> [--id <id>] [--body "text"]',
        });
      }
      body_md = next ?? "";
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  const title = positional[0];
  if (!title) {
    exitWithError(2, "Title is required", {
      hint: 'Usage: aligntrue note create <title> [--id <id>] [--body "text"]',
    });
  }

  const note_id: string = customId ?? Identity.deterministicId(title);
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
