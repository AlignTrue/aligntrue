import type { PackModule } from "@aligntrue/ops-core";
import { manifest } from "./manifest.js";
import { handlers } from "./handlers.js";
import { HelloWorldProjection } from "./projection.js";

const moduleImpl: PackModule = {
  manifest,
  handlers,
  projections: [HelloWorldProjection],
};

export default moduleImpl;
export { manifest, handlers, HelloWorldProjection };
