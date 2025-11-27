import { describe, it, expect } from "vitest";
import JunieExporter from "../src/junie/index.js";
import GooseExporter from "../src/goose/index.js";

describe("AGENTS delegation exporters", () => {
  it("should export junie as AGENTS exporter", () => {
    const exporter = JunieExporter;
    expect(exporter).toBeDefined();
    expect(exporter.name).toBe("junie");
    expect(typeof exporter.export).toBe("function");
  });

  it("should export goose as AGENTS exporter", () => {
    const exporter = GooseExporter;
    expect(exporter).toBeDefined();
    expect(exporter.name).toBe("goose");
    expect(typeof exporter.export).toBe("function");
  });
});
