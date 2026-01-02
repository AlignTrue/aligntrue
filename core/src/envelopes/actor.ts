export interface ActorRef {
  readonly actor_id: string;
  readonly actor_type: "human" | "service" | "agent";
  readonly display_name?: string;
}
