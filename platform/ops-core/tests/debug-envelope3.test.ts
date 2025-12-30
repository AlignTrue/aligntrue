import { describe, it } from "vitest";

describe("debug3", () => {
  it("shows full module", async () => {
    // Use dynamic import to see full module
    const module = await import("../src/envelopes/command.js");

    console.log("\nAll module exports:", Object.keys(module));
    console.log(
      "\nDEDUPE_SCOPE_REQUIREMENTS:",
      module.DEDUPE_SCOPE_REQUIREMENTS,
    );

    // Try to access non-exported const
    // @ts-ignore
    console.log(
      "\nREQUIRED_COMMAND_FIELDS (if accessible):",
      (module as any).REQUIRED_COMMAND_FIELDS,
    );

    // Check validate source again
    console.log(
      "\nvalidateCommandEnvelope:",
      module.validateCommandEnvelope.toString(),
    );
  });
});
