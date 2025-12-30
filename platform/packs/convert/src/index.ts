import type { PackModule } from "@aligntrue/ops-core";
import { manifest } from "./manifest.js";
import { commandHandlers } from "./commands.js";
import { ConversionsProjectionDef } from "./projection.js";

const moduleImpl: PackModule = {
  manifest,
  commandHandlers,
  projections: [ConversionsProjectionDef],
};

export default moduleImpl;
export { manifest } from "./manifest.js";
export { commandHandlers } from "./commands.js";
export {
  ConversionsProjectionDef,
  CONVERSIONS_PROJECTION,
  type ConversionsProjection,
  type ConversionsProjectionState,
  type ConversionRecord,
  buildConversionsProjectionFromState,
  hashConversionsProjection,
} from "./projection.js";
