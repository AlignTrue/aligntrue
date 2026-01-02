import type { ActorRef } from "@aligntrue/core";

export const CLI_ACTOR: ActorRef = {
  actor_id: process.env["USER"] || "cli-user",
  actor_type: "human",
  display_name: process.env["USER"] || "CLI User",
};
