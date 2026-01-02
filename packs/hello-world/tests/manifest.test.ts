import { describe, expect, it } from "vitest";
import { manifest } from "../src/manifest.js";

describe("pack-hello-world manifest", () => {
  it("uses the expected pack id and version", () => {
    expect(manifest.pack_id).toBe("hello-world");
    expect(manifest.version).toMatch(/^0\.\d+\.\d+/);
  });

  it("exposes at least one public event", () => {
    expect(manifest.public_events.length).toBeGreaterThan(0);
    expect(manifest.public_commands.length).toBe(0);
  });
});
