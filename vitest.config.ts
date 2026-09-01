import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // One shared module graph so Mongoose models register once and error
    // classes keep a single identity across test files.
    isolate: false,
    fileParallelism: false,
  },
});
