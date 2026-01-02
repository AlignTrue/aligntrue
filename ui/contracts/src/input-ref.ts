export type InputArtifactType =
  | "message"
  | "projection"
  | "document"
  | "tool_output";

export interface InputRef {
  readonly artifact_type: InputArtifactType;
  readonly artifact_id: string; // content-addressed ID of stored artifact
}
