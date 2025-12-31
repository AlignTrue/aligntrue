import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import type { ActorRef } from "@aligntrue/ops-core";

const COOKIE_NAME = "ui_actor_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function getOrCreateActorId(): Promise<ActorRef> {
  const jar = await cookies();
  const existing = jar.get(COOKIE_NAME)?.value;
  const actor_id = existing ?? randomUUID();
  if (!existing) {
    jar.set(COOKIE_NAME, actor_id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }
  return { actor_id, actor_type: "human" };
}
