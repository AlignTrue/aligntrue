export type { ActorRef } from "./actor.js";
export type { EventEnvelope } from "./event.js";
export type {
  CommandEnvelope,
  CommandOutcome,
  DedupeScope,
} from "./command.js";
export { validateEventEnvelope } from "./event.js";
export { validateCommandEnvelope, validateDedupeScope } from "./command.js";
