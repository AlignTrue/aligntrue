import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("debug source", () => {
  it("checks source file content", () => {
    const sourcePath = join(__dirname, "../src/envelopes/command.ts");
    const source = readFileSync(sourcePath, "utf-8");

    console.log("\n=== Source file content ===");
    console.log(source.slice(0, 2000));
    console.log("...");

    // Check if idempotency_key is in REQUIRED_COMMAND_FIELDS
    const requiredFieldsMatch = source.match(
      /REQUIRED_COMMAND_FIELDS.*?\[[\s\S]*?\]/,
    );
    if (requiredFieldsMatch) {
      console.log("\n=== REQUIRED_COMMAND_FIELDS definition ===");
      console.log(requiredFieldsMatch[0]);
    }

    expect(source).toContain("idempotency_key");
  });
});
