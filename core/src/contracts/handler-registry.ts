import type { CommandEnvelope, CommandOutcome } from "../envelopes/command.js";
import type { PackCommandHandler, PackContext } from "./pack-module.js";

/**
 * Typed helper to define command handlers with payload inference.
 * Consumers pass a mapping of command_type -> payload shape and get
 * strongly typed command objects in handlers without local casts.
 */
export function defineCommandHandlers<
  TMap extends Record<string, unknown>,
>(handlers: {
  [K in keyof TMap]: (
    command: CommandEnvelope<K & string, TMap[K]>,
    context: PackContext,
  ) => Promise<CommandOutcome | void>;
}): Record<string, PackCommandHandler> {
  return handlers as Record<string, PackCommandHandler>;
}
