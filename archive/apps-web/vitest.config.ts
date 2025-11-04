import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  // CRITICAL: Use automatic JSX runtime to match Next.js production behavior
  // Without this, tests fail with "React is not defined" because test files
  // don't import React (following modern conventions). The canary test
  // (tests/jsx-runtime.test.tsx) will catch if this config is removed.
  esbuild: {
    jsx: "automatic",
  },
});
