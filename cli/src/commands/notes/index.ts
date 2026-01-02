import { exitWithError } from "../../utils/command-utilities.js";
import { createNote } from "./create.js";
import { editNote } from "./edit.js";
import { listNotes } from "./list.js";
import { showNote } from "./show.js";
import { ensureNotesEnabled } from "./shared.js";

const HELP_TEXT = `
Usage: aligntrue note <subcommand> [options]

Subcommands:
  create <title> [--id <id>] [--body "text"]    Create a note
  edit <id>                                     Edit a note in $EDITOR
  show <id>                                     Show a note
  list                                          List notes
`;

export async function note(args: string[]): Promise<void> {
  ensureNotesEnabled();
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help" || sub === "-h") {
    console.log(HELP_TEXT.trim());
    return;
  }

  switch (sub) {
    case "create":
      await createNote(rest);
      break;
    case "edit":
      await editNote(rest);
      break;
    case "show":
      await showNote(rest);
      break;
    case "list":
      await listNotes();
      break;
    default:
      exitWithError(2, `Unknown subcommand: ${sub}`, {
        hint: "Run aligntrue note --help",
      });
  }
}
