/**
 * Version command tests
 * Verifies that --version reads from package.json
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

describe("Version Command", () => {
  it("outputs version from package.json", () => {
    // Read expected version from package.json
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, "../package.json"), "utf8"),
    );
    const expectedVersion = packageJson.version;

    // Run aligntrue --version
    const output = execSync("node dist/index.js --version", {
      cwd: join(__dirname, ".."),
      encoding: "utf8",
    }).trim();

    expect(output).toBe(expectedVersion);
  });

  it("supports -v alias", () => {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, "../package.json"), "utf8"),
    );
    const expectedVersion = packageJson.version;

    const output = execSync("node dist/index.js -v", {
      cwd: join(__dirname, ".."),
      encoding: "utf8",
    }).trim();

    expect(output).toBe(expectedVersion);
  });
});
