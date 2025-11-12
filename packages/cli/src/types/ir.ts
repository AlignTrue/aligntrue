import type { AlignSection } from "@aligntrue/schema";

export interface ParsedIR {
  version: string;
  sections: AlignSection[];
}

export function isValidIR(obj: unknown): obj is ParsedIR {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "sections" in obj &&
    Array.isArray((obj as Record<string, unknown>)["sections"])
  );
}
