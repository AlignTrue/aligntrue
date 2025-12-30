import type { PackModule } from "@aligntrue/ops-core";
import { Tasks } from "@aligntrue/ops-core";
import { manifest } from "./manifest.js";
import { commandHandlers } from "./commands.js";

const { TasksProjectionDef } = Tasks;

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
} from "@aligntrue/ops-core/projections";
export * from "@aligntrue/ops-core/tasks";
