import { defineCommand } from "../../utils/command-router.js";
import { completeTask } from "./complete.js";
import { createTask } from "./create.js";
import { listTasks } from "./list.js";
import { reopenTask } from "./reopen.js";
import { triageTask } from "./triage.js";
import { ensureTasksEnabled } from "./shared.js";

export const task = defineCommand({
  name: "task",
  guard: ensureTasksEnabled,
  subcommands: {
    create: {
      handler: createTask,
      description: "Create a task",
    },
    list: {
      handler: listTasks,
      description: "List tasks",
    },
    triage: {
      handler: triageTask,
      description: "Triage or update a task",
    },
    complete: {
      handler: completeTask,
      description: "Mark task completed",
    },
    reopen: {
      handler: reopenTask,
      description: "Reopen a completed task",
    },
  },
});
