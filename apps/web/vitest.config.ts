import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    environment: "node",
  },
});
