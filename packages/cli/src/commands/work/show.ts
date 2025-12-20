import { exitWithError } from "../../utils/command-utilities.js";
import { readProjections } from "./shared.js";

export async function showWork(args: string[]): Promise<void> {
  const workId = args[0];
  const projection = await readProjections();

  if (workId) {
    const item = projection.workItems.items[workId];
    if (!item) {
      exitWithError(1, `Work item not found: ${workId}`);
      return;
    }
    printItem(item);
    return;
  }

  const ids = Object.keys(projection.workItems.items).sort();
  if (ids.length === 0) {
    console.log("No work items found.");
    return;
  }
  for (const id of ids) {
    const item = projection.workItems.items[id];
    if (!item) continue;
    printItem(item);
  }
}

function printItem(item: {
  id: string;
  title: string;
  description?: string | undefined;
  status: string;
  blocked: boolean;
  blocked_reason?: string | undefined;
  dependencies: string[];
  updated_at: string;
}) {
  console.log(
    `- ${item.id}: ${item.title} [${item.status}${item.blocked ? ", blocked" : ""}]`,
  );
  if (item.description) {
    console.log(`  desc: ${item.description}`);
  }
  if (item.dependencies.length > 0) {
    console.log(`  deps: ${item.dependencies.join(", ")}`);
  }
  if (item.blocked_reason) {
    console.log(`  reason: ${item.blocked_reason}`);
  }
  console.log(`  updated: ${item.updated_at}`);
}
