import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Force the deterministic mock providers regardless of what `.env` has
    // configured for local live-integration testing (e.g. real Shiprocket
    // credentials) — `dotenv/config` in `src/config/env.ts` never overrides
    // an already-set process.env value, so these win.
    env: { SHIPPING_PROVIDER: "mock", PAYMENT_PROVIDER: "mock" },
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
