import { Tasks, type PackCommandHandler } from "@aligntrue/ops-core";

const { TASK_COMMAND_TYPES } = Tasks;

export const commandHandlers: Record<string, PackCommandHandler> = {
  [TASK_COMMAND_TYPES.Create]: async (command, context) => {
    const ledger = new Tasks.TaskLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as Tasks.TaskCommandEnvelope);
  },
  [TASK_COMMAND_TYPES.Triage]: async (command, context) => {
    const ledger = new Tasks.TaskLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as Tasks.TaskCommandEnvelope);
  },
  [TASK_COMMAND_TYPES.Complete]: async (command, context) => {
    const ledger = new Tasks.TaskLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as Tasks.TaskCommandEnvelope);
  },
  [TASK_COMMAND_TYPES.Reopen]: async (command, context) => {
    const ledger = new Tasks.TaskLedger(context.eventStore, context.commandLog);
    return ledger.execute(command as Tasks.TaskCommandEnvelope);
  },
};
