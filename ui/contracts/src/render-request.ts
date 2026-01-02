import type { ActorRef } from "@aligntrue/core";
import type { InputRef } from "./input-ref.js";

export interface RenderRequest {
  readonly request_id: string; // client-generated
  readonly blocks: BlockRequest[];
  readonly layout: LayoutRequest;
  readonly input_refs: InputRef[]; // what AI saw
  readonly correlation_id: string;
  readonly actor: ActorRef;
}

export interface BlockRequest {
  readonly block_instance_id: string;
  readonly block_type: string;
  readonly props: unknown; // unvalidated
  readonly slot: string;
}

export interface LayoutRequest {
  readonly template: "single" | "split" | "dashboard" | "inbox";
}
