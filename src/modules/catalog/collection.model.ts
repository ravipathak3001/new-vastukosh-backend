import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";
import { seoMetaSchema } from "../seo/seo.model.js";
import { PRODUCT_CATEGORIES, PRODUCT_NEEDS } from "./product.model.js";

/**
 * A curated storefront landing (e.g. "Shop by Purpose: New Home"). Its filter is
 * applied against the Product collection at query time.
 */
const collectionSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: localizedSchema, required: true },
    description: { type: localizedSchema, required: true },
    filter: {
      category: { type: String, enum: PRODUCT_CATEGORIES },
      need: { type: String, enum: PRODUCT_NEEDS },
      rashi: { type: String },
    },
    heroImage: { type: String },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true, index: true },
    seo: { type: seoMetaSchema, required: false },
  },
  { timestamps: true },
);

export type Collection = InferSchemaType<typeof collectionSchema>;
export type CollectionDoc = HydratedDocument<Collection>;

export const CollectionModel = defineModel("Collection", collectionSchema);
