import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildPackZip, buildZipFilename } from "./zip-builder";

describe("buildZipFilename", () => {
  it("sanitizes filenames and appends .zip", () => {
    expect(buildZipFilename("my pack/name")).toBe("my-pack-name.zip");
  });

  it("falls back to align-pack when base is empty", () => {
    expect(buildZipFilename("")).toBe("align-pack.zip");
    expect(buildZipFilename("%%%")).toBe("-.zip");
  });
});

describe("buildPackZip", () => {
  it("creates a zip containing provided files", async () => {
    const blob = await buildPackZip([
      { path: "rules/a.md", size: 5, content: "hello" },
      { path: "b.md", size: 5, content: "world" },
    ]);

    const buffer = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(["rules/a.md", "b.md"]),
    );
    const file = zip.file("b.md");
    expect(file).toBeDefined();
    expect(await file?.async("string")).toBe("world");
  });
});
