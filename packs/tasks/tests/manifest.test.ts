import { describe, expect, it } from "vitest";
import { manifest } from "../src/manifest.js";

describe("pack-tasks manifest", () => {
  it("uses the expected pack id and version", () => {
    expect(manifest.pack_id).toBe("tasks");
    expect(manifest.version).toMatch(/^0\.\d+\.\d+/);
  });

  it("declares commands, events, and projections", () => {
    expect(manifest.public_commands.length).toBeGreaterThan(0);
    expect(manifest.public_events.length).toBeGreaterThan(0);
    expect(manifest.projections.length).toBeGreaterThan(0);
  });
});
