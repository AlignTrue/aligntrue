import type { PackManifest } from "@aligntrue/core";

export const manifest: PackManifest = {
  pack_id: "hello-world",
  version: "0.0.1",
  required_core: ">=0.0.0",
  public_events: ["pack.hello-world.greeting.emitted"],
  public_commands: [],
};
