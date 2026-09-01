import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { printSchema, lexicographicSortSchema } from "graphql";
import { buildSchema } from "./schema.js";

/**
 * Emit the SDL to `backend/schema.graphql`. This file is the published contract
 * for the frontend codegen and the future mobile client — commit it.
 */
const sdl = printSchema(lexicographicSortSchema(buildSchema()));
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../../schema.graphql");
writeFileSync(out, `${sdl}\n`, "utf8");
// eslint-disable-next-line no-console
console.log(`✔ Wrote ${out}`);
