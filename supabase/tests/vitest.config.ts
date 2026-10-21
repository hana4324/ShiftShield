import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Each file boots its own embedded Postgres; keep them sequential to bound memory.
    fileParallelism: false,
  },
});
