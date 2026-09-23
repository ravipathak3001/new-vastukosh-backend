import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import type { GrahaName } from "vedic-kundali";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";

/**
 * Mirrors the 9 grahas everywhere else in the codebase key by (`GRAHAS` in the frontend's
 * `lib/bracelet/gems.ts`, `GEMSTONE_BY_GRAHA` in `../kundali/graha-reference.ts`). No runtime export
 * of this list exists in `vedic-kundali` itself — `GrahaName` there is a type only — so, like
 * `GEMSTONE_BY_GRAHA`, this is the literal list, typed against that import for safety.
 */
export const STONE_GRAHAS: readonly GrahaName[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
];

export const STONE_STATUSES = ["draft", "active", "archived"] as const;
export type StoneStatus = (typeof STONE_STATUSES)[number];

/**
 * One purchasable gemstone (or its budget alternatives) for a bracelet segment — priced per bead so
 * a combination bracelet's total is computed from whichever stone each segment uses, not looked up as
 * a flat per-product price. A stone can serve more than one graha (e.g. Hematite for both Mars and
 * Saturn), hence `grahas` is a list. Bead visuals (colour, 3D material, shape) are *not* stored here —
 * those stay a frontend concern in `lib/bracelet/gems.ts`, the same way they already do for the
 * fixed 9-graha gems; this model owns only the business data an admin needs to edit: price,
 * availability, which grahas it serves.
 */
const stoneSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: localizedSchema, required: true },
    grahas: { type: [String], enum: STONE_GRAHAS, required: true, validate: (v: string[]) => v.length > 0 },
    /** True for the traditional/precious gem (e.g. Ruby for Sun) — shown first and labelled distinctly from the budget alternatives. */
    primary: { type: Boolean, default: false, index: true },
    pricePerBead: { type: Number, required: true, min: 0 },
    description: { type: localizedSchema, required: false },
    status: { type: String, enum: STONE_STATUSES, default: "active", index: true },
  },
  { timestamps: true },
);

export type Stone = InferSchemaType<typeof stoneSchema>;
export type StoneDoc = HydratedDocument<Stone>;

export const StoneModel = defineModel("Stone", stoneSchema);
