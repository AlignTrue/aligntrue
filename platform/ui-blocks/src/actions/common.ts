import type {
  CommandEnvelope,
  CommandOutcome,
} from "@aligntrue/ops-core/envelopes";

export type CommandDispatcher = (
  envelope: CommandEnvelope,
) => Promise<CommandOutcome>;
