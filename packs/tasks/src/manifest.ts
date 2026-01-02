import { type PackManifest, Contracts } from "@aligntrue/core";

const { TASK_COMMAND_TYPES, TASK_EVENT_TYPES, TASK_PROJECTION } = Contracts;

export const manifest: PackManifest = {
  pack_id: "tasks",
  version: "0.0.1",
  required_core: ">=0.0.0",
  public_events: Object.values(TASK_EVENT_TYPES),
  public_commands: Object.values(TASK_COMMAND_TYPES),
  projections: [TASK_PROJECTION],
  capabilities_requested: [],
};
