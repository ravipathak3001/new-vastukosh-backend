import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";
import { seoMetaSchema } from "../seo/seo.model.js";

export const PRODUCT_CATEGORIES = [
  "yantras",
  "crystals",
  "malas",
  "vastukits",
  "idols",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_NEEDS = [
  "newhome",
  "vehicle",
  "business",
  "prosperity",
  "peace",
] as const;
export type ProductNeed = (typeof PRODUCT_NEEDS)[number];

export const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

const detailSchema = new Schema(
  { title: { type: localizedSchema, required: true }, body: { type: localizedSchema, required: true } },
  { _id: false },
);

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: localizedSchema, required: true },
    tagline: { type: localizedSchema, required: true },
    description: { type: localizedSchema, required: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    category: { type: String, enum: PRODUCT_CATEGORIES, required: true, index: true },
    rashis: { type: [String], default: [], index: true },
    needs: { type: [String], enum: PRODUCT_NEEDS, default: [], index: true },
    image: { type: String, required: true },
    gallery: { type: [String], default: [] },
    featured: { type: Boolean, default: false, index: true },
    highlights: { type: [localizedSchema], default: [] },
    details: { type: [detailSchema], default: [] },
    status: { type: String, enum: PRODUCT_STATUSES, default: "active", index: true },
    seo: { type: seoMetaSchema, required: false },
  },
  { timestamps: true },
);

export type Product = InferSchemaType<typeof productSchema>;
export type ProductDoc = HydratedDocument<Product>;

export const ProductModel = defineModel("Product", productSchema);
