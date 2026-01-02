import { defineCommand } from "../../utils/command-router.js";
import { blockWork } from "./block.js";
import { completeWork } from "./complete.js";
import { manageDependency } from "./dep.js";
import { createWork } from "./create.js";
import { showReady } from "./ready.js";
import { ensureOpsCoreEnabled } from "./shared.js";
import { showWork } from "./show.js";
import { unblockWork } from "./unblock.js";

export const work = defineCommand({
  name: "work",
  guard: ensureOpsCoreEnabled,
  subcommands: {
    create: { handler: createWork, description: "Create a work item" },
    show: { handler: showWork, description: "Show work items" },
    ready: { handler: showReady, description: "List ready work items" },
    complete: { handler: completeWork, description: "Mark work completed" },
    block: { handler: blockWork, description: "Block a work item" },
    unblock: { handler: unblockWork, description: "Unblock a work item" },
    dep: { handler: manageDependency, description: "Manage dependencies" },
  },
});
