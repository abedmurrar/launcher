import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Next's server-only guard throws outside the Next bundler.
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Tests spawn real processes and use process groups.
    pool: "forks",
    setupFiles: ["test/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      LAUNCHER_STOP_GRACE_MS: "500",
      LAUNCHER_LIST_DEBOUNCE_MS: "50",
    },
  },
});
