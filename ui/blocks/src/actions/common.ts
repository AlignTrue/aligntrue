import type {
  CommandEnvelope,
  CommandOutcome,
} from "@aligntrue/core/envelopes";

export type CommandDispatcher = (
  envelope: CommandEnvelope,
) => Promise<CommandOutcome>;
