import { readProjections } from "./shared.js";

export async function showReady(): Promise<void> {
  const projection = await readProjections();
  if (projection.readyQueue.ready.length === 0) {
    console.log("Ready queue is empty.");
    return;
  }
  console.log("Ready work items:");
  for (const id of projection.readyQueue.ready) {
    console.log(`- ${id}`);
  }
}
