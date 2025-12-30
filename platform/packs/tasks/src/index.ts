import type { PackModule } from "@aligntrue/ops-core";
import { manifest } from "./manifest.js";
import { commandHandlers } from "./commands.js";
import { TasksProjectionDef } from "./projection.js";

const moduleImpl: PackModule = {
  manifest,
  commandHandlers,
  projections: [TasksProjectionDef],
};

export default moduleImpl;
export { manifest } from "./manifest.js";
export { commandHandlers } from "./commands.js";
export {
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  type TasksProjection,
  type TasksProjectionState,
  type TaskLatest,
} from "./projection.js";
export * from "./events.js";
export * from "./types.js";
