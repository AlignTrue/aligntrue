import { Contracts, type PackManifest } from "@aligntrue/ops-core";
import { SUGGESTIONS_PROJECTION } from "./projection.js";

const { SUGGESTION_COMMAND_TYPES, SUGGESTION_EVENT_TYPES } = Contracts;

export const manifest: PackManifest = {
  pack_id: "suggestions",
  version: "0.0.1",
  required_core: ">=0.0.0",
  public_events: Object.values(SUGGESTION_EVENT_TYPES),
  public_commands: Object.values(SUGGESTION_COMMAND_TYPES),
  projections: [SUGGESTIONS_PROJECTION],
  capabilities_requested: [],
};
