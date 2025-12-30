import type { PackEventHandler } from "@aligntrue/ops-core";

export const HELLO_EVENT = "pack.hello-world.greeting.emitted";

export const handlers: Record<string, PackEventHandler> = {
  [HELLO_EVENT]: async (event) => {
    // No-op handler; proves dispatch wiring works.
    void event;
  },
};
