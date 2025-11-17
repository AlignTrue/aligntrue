import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest-setup.ts"],
    // Integration suites spawn the CLI and touch real files; Windows runners
    // are slower, so give them more room without penalizing fast unit tests.
    testTimeout: 30_000,
  },
});
