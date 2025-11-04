/**
 * Canary test: Validates JSX works without explicit React imports
 *
 * This test ensures Vitest is configured for automatic JSX runtime.
 * If this fails with "React is not defined", check vitest.config.ts
 * esbuild.jsx setting.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

describe("JSX Runtime Canary", () => {
  it("should render JSX without importing React", () => {
    // No "import React" in this file - automatic runtime should handle it
    const { container } = render(<div data-testid="canary">✓ JSX works</div>);
    expect(container.querySelector('[data-testid="canary"]')).toBeTruthy();
  });
});
