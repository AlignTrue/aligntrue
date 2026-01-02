import type {
  EventEnvelope,
  PackContext,
  PackEventHandler,
} from "@aligntrue/core";

export const HELLO_EVENT = "pack.hello-world.greeting.emitted";

export const handlers: Record<string, PackEventHandler> = {
  [HELLO_EVENT]: async (
    event: EventEnvelope,
    _context: PackContext,
  ): Promise<void> => {
    // No-op handler; proves dispatch wiring works.
    void event;
  },
};
