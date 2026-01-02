import { type PackManifest, Contracts } from "@aligntrue/core";
import { CONVERSIONS_PROJECTION } from "./projection.js";

const { CONVERT_COMMAND_TYPES } = Contracts;

export const manifest: PackManifest = {
  pack_id: "convert",
  version: "0.0.1",
  required_core: ">=0.0.0",
  public_events: [],
  public_commands: Object.values(CONVERT_COMMAND_TYPES),
  projections: [CONVERSIONS_PROJECTION],
  capabilities_requested: [],
};
