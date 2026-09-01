import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";

/**
 * Read-only reference data (the 12 Vedic zodiac signs). Seeded from the
 * frontend's `data/rashis.ts`. The birth-date → rashi maths stays a client
 * helper on the frontend; the API only serves the canonical list.
 */
const rashiSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    order: { type: Number, required: true },
    name: { type: localizedSchema, required: true },
    western: { type: String, required: true },
    symbol: { type: String, required: true },
    image: { type: String, required: true },
  },
  { timestamps: true },
);

export type Rashi = InferSchemaType<typeof rashiSchema>;
export type RashiDoc = HydratedDocument<Rashi>;

export const RashiModel = defineModel("Rashi", rashiSchema);
