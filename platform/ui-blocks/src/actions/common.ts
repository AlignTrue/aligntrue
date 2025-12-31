import type { CommandEnvelope, CommandOutcome } from "@aligntrue/ops-core";

export type CommandDispatcher = (
  envelope: CommandEnvelope,
) => Promise<CommandOutcome>;
