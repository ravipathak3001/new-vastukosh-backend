import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { printSchema, lexicographicSortSchema } from "graphql";
import { buildSchema } from "./schema.js";

/**
 * Fail if the committed `schema.graphql` is stale relative to the code. This is
 * the backend's half of "codegen": the SDL is the published contract that the
 * frontend and mobile clients generate types from, so a drifted file means a
 * broken client build. Runs as `pretest` and belongs in CI.
 */
const expected = printSchema(lexicographicSortSchema(buildSchema())) + "\n";
const file = resolve(dirname(fileURLToPath(import.meta.url)), "../../schema.graphql");

let actual = "";
try {
  actual = readFileSync(file, "utf8");
} catch {
  // treated as a mismatch below
}

if (actual !== expected) {
  // eslint-disable-next-line no-console
  console.error(
    "✖ schema.graphql is out of date with the Pothos schema.\n" +
      "  Run `npm run print-schema` and commit the result.",
  );
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("✔ schema.graphql is up to date");
