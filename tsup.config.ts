import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/db/seed.ts", "src/graphql/print-schema.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  // Native/CJS deps that should not be bundled.
  external: ["mongoose", "bcryptjs", "express"],
});
