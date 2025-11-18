import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..", "..");
const packagesDir = join(root, "packages");
const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

function readPackageJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as {
    name: string;
    version: string;
    [key: string]: unknown;
  };
}

const packageJsonPaths = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(packagesDir, entry.name, "package.json"));

describe("workspace version sync", () => {
  it("keeps all package versions aligned", () => {
    const versions = packageJsonPaths.map((path) => ({
      path,
      version: readPackageJson(path).version,
    }));

    const uniqueVersions = new Set(versions.map((item) => item.version));

    expect(
      [...uniqueVersions],
      `Version mismatch detected:\n${versions
        .map((item) => `${item.version} ← ${item.path}`)
        .join("\n")}`,
    ).toHaveLength(1);
  });

  it("uses workspace:* for all @aligntrue/* dependencies", () => {
    const workspaceNames = new Set(
      packageJsonPaths.map((path) => readPackageJson(path).name),
    );

    for (const packagePath of packageJsonPaths) {
      const pkg = readPackageJson(packagePath);

      for (const section of sections) {
        const deps = pkg[section] as Record<string, string> | undefined;
        if (!deps) continue;

        for (const [depName, version] of Object.entries(deps)) {
          if (!workspaceNames.has(depName)) continue;
          expect(
            version,
            `${packagePath} -> ${section}.${depName} must be workspace:*`,
          ).toBe("workspace:*");
        }
      }
    }
  });
});
