import { Contracts, type PackCommandHandler } from "@aligntrue/ops-core";
import {
  TaskLedger,
  type TaskCommandEnvelope,
  type TaskCommandType,
} from "./ledger.js";

const { TASK_COMMAND_TYPES } = Contracts;

export const commandHandlers: Record<string, PackCommandHandler> = {
  [TASK_COMMAND_TYPES.Create]: async (command, context) => {
    const ledger = new TaskLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as TaskCommandEnvelope<TaskCommandType>);
  },
  [TASK_COMMAND_TYPES.Triage]: async (command, context) => {
    const ledger = new TaskLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as TaskCommandEnvelope<TaskCommandType>);
  },
  [TASK_COMMAND_TYPES.Complete]: async (command, context) => {
    const ledger = new TaskLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as TaskCommandEnvelope<TaskCommandType>);
  },
  [TASK_COMMAND_TYPES.Reopen]: async (command, context) => {
    const ledger = new TaskLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as TaskCommandEnvelope<TaskCommandType>);
  },
};
