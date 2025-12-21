import { writeFile, readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { exitWithError } from "../../utils/command-utilities.js";
import {
  buildCommand,
  createLedger,
  ensureNotesEnabled,
  readNotesProjection,
} from "./shared.js";

export async function editNote(args: string[]): Promise<void> {
  ensureNotesEnabled();
  const noteId = args[0];
  if (!noteId) {
    exitWithError(2, "Note ID is required", {
      hint: "Usage: aligntrue note edit <id>",
    });
  }

  const projection = await readNotesProjection();
  const note = projection.notes.find((n) => n.id === noteId);
  if (!note) {
    exitWithError(1, `Note ${noteId} not found`);
  }

  const dir = await mkdtemp(join(tmpdir(), "aligntrue-note-"));
  const file = join(dir, `${noteId}.md`);
  await writeFile(file, note.body_md, "utf8");

  const editor = process.env["EDITOR"] || "vi";
  const result = spawnSync(editor, [file], { stdio: "inherit" });
  if (result.status !== 0) {
    exitWithError(result.status ?? 1, "Editor exited with error");
  }

  const nextBody = await readFile(file, "utf8");
  if (nextBody === note.body_md) {
    console.log("No changes made.");
    return;
  }

  const ledger = createLedger();
  const outcome = await ledger.execute(
    buildCommand("note.update", {
      note_id: noteId,
      body_md: nextBody,
    }),
  );

  console.log(
    `Updated ${noteId}: ${outcome.status} (events: ${outcome.produced_events.length})`,
  );
}
