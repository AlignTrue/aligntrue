import { type PackManifest, Contracts } from "@aligntrue/core";
import { NOTE_PROJECTION } from "./projection.js";

const { NOTE_COMMAND_TYPES, NOTE_EVENT_TYPES } = Contracts;

export const manifest: PackManifest = {
  pack_id: "notes",
  version: "0.0.1",
  required_core: ">=0.0.0",
  public_events: Object.values(NOTE_EVENT_TYPES),
  public_commands: Object.values(NOTE_COMMAND_TYPES),
  projections: [NOTE_PROJECTION],
  capabilities_requested: [],
};
