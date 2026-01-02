import { type PackCommandHandler, Contracts } from "@aligntrue/core";
import {
  NoteLedger,
  type NoteCommandEnvelope,
  type NoteCommandType,
} from "./ledger.js";

const { NOTE_COMMAND_TYPES } = Contracts;

export const commandHandlers: Record<string, PackCommandHandler> = {
  [NOTE_COMMAND_TYPES.Create]: async (command, context) => {
    const ledger = new NoteLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as NoteCommandEnvelope<NoteCommandType>);
  },
  [NOTE_COMMAND_TYPES.Update]: async (command, context) => {
    const ledger = new NoteLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as NoteCommandEnvelope<NoteCommandType>);
  },
  [NOTE_COMMAND_TYPES.PatchCheckbox]: async (command, context) => {
    const ledger = new NoteLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as NoteCommandEnvelope<NoteCommandType>);
  },
};
