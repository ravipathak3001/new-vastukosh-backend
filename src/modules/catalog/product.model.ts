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
  "bracelets",
  "coins",
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
    /** 1–2 sentences for product cards and the summary beside the price. Optional — falls back to the description's first paragraph. */
    shortDescription: { type: localizedSchema, required: false },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    stockQty: { type: Number, required: true, min: 0, default: 0 },
    /**
     * Shipping: one unit as packed for dispatch (box + padding included).
     * Optional — `startDelivery` falls back to a default parcel when missing.
     */
    weightGrams: { type: Number, min: 0 },
    lengthCm: { type: Number, min: 0 },
    breadthCm: { type: Number, min: 0 },
    heightCm: { type: Number, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    category: { type: String, enum: PRODUCT_CATEGORIES, required: true, index: true },
    rashis: { type: [String], default: [], index: true },
    needs: { type: [String], enum: PRODUCT_NEEDS, default: [], index: true },
    grahas: { type: [String], default: [], index: true },
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
