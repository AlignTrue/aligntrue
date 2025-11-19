import { describe, it, expect } from "vitest";
import { resolveHierarchicalScopes } from "../../src/scope.js";
import type { AlignTrueConfig } from "../../src/config/index.js";

describe("resolveHierarchicalScopes", () => {
  const baseConfig: AlignTrueConfig = {
    mode: "team",
    version: "1",
    scopes: [],
  };

  it("should return only root for root scope", () => {
    const chain = resolveHierarchicalScopes(".", baseConfig);
    expect(chain).toEqual(["."]);
  });

  it("should return chain for nested scope (default inheritance)", () => {
    const chain = resolveHierarchicalScopes("apps/web", baseConfig);
    expect(chain).toEqual([".", "apps", "apps/web"]);
  });

  it("should respect inherit: false in leaf scope", () => {
    const config: AlignTrueConfig = {
      ...baseConfig,
      scopes: [{ path: "apps/web", inherit: false }],
    };
    const chain = resolveHierarchicalScopes("apps/web", config);
    expect(chain).toEqual(["apps/web"]);
  });

  it("should respect inherit: false in intermediate scope", () => {
    const config: AlignTrueConfig = {
      ...baseConfig,
      scopes: [{ path: "apps", inherit: false }],
    };
    const chain = resolveHierarchicalScopes("apps/web", config);
    // apps/web inherits from apps, but apps does NOT inherit from root
    expect(chain).toEqual(["apps", "apps/web"]);
  });

  it("should handle deep nesting", () => {
    const chain = resolveHierarchicalScopes(
      "packages/core/src/utils",
      baseConfig,
    );
    expect(chain).toEqual([
      ".",
      "packages",
      "packages/core",
      "packages/core/src",
      "packages/core/src/utils",
    ]);
  });

  it("should handle mixed inheritance settings", () => {
    const config: AlignTrueConfig = {
      ...baseConfig,
      scopes: [
        { path: "packages", inherit: true },
        { path: "packages/isolated", inherit: false },
        { path: "packages/isolated/child", inherit: true },
      ],
    };

    // Normal inheritance
    expect(resolveHierarchicalScopes("packages/normal", config)).toEqual([
      ".",
      "packages",
      "packages/normal",
    ]);

    // Isolated scope (breaks chain)
    expect(resolveHierarchicalScopes("packages/isolated", config)).toEqual([
      "packages/isolated",
    ]);

    // Child of isolated scope (inherits from isolated, but isolated breaks chain from root)
    expect(
      resolveHierarchicalScopes("packages/isolated/child", config),
    ).toEqual(["packages/isolated", "packages/isolated/child"]);
  });
});
