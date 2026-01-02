import { writeFile, readFile, mkdtemp } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { Identity } from "@aligntrue/core";
import { exitWithError } from "../../utils/command-utilities.js";
import { parseArgs } from "../../utils/args.js";
import {
  buildCommand,
  createLedger,
  ensureNotesEnabled,
  readNotesProjection,
} from "./shared.js";
import * as PackNotes from "@aligntrue/pack-notes";

export async function editNote(args: string[]): Promise<void> {
  ensureNotesEnabled();

  const parsed = parseArgs(args, []);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "), {
      hint: "Usage: aligntrue note edit <id>",
    });
  }

  const noteId = parsed.positional[0];
  if (!noteId) {
    exitWithError(2, "Note ID is required", {
      hint: "Usage: aligntrue note edit <id>",
    });
  }

  const projection = await readNotesProjection();
  const note = projection.notes.find(
    (n: PackNotes.NoteLatest) => n.id === noteId,
  );
  if (!note) {
    exitWithError(1, `Note ${noteId} not found`);
  }

  const dir = await mkdtemp(join(tmpdir(), "aligntrue-note-"));
  const file = resolve(dir, `${noteId}.md`);
  ensurePathWithinDir(file, dir);
  // Path confined to mkdtemp-generated directory.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await writeFile(file, note.body_md, "utf8");

  const editor = process.env["EDITOR"] || "vi";
  const result = spawnSync(editor, [file], { stdio: "inherit" });
  if (result.status !== 0) {
    exitWithError(result.status ?? 1, "Editor exited with error");
  }

  // Path confined to mkdtemp-generated directory.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const nextBody = await readFile(file, "utf8");
  if (nextBody === note.body_md) {
    console.log("No changes made.");
    return;
  }

  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand(PackNotes.NOTE_COMMAND_TYPES.Update, {
      note_id: noteId,
      body_md: nextBody,
      content_hash: Identity.hashCanonical(nextBody),
    }),
  );

  console.log(
    `Updated ${noteId}: ${outcome.status} (events: ${outcome.produced_events?.length ?? 0})`,
  );
}

function ensurePathWithinDir(targetPath: string, baseDir: string): void {
  const resolvedBase = resolve(baseDir);
  const baseWithSep = resolvedBase.endsWith(sep)
    ? resolvedBase
    : `${resolvedBase}${sep}`;
  const resolvedTarget = resolve(targetPath);
  if (!resolvedTarget.startsWith(baseWithSep)) {
    exitWithError(2, "Resolved path escaped expected directory");
  }
}
