import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";
import { seoMetaSchema } from "../seo/seo.model.js";

// ─── Testimonial ──────────────────────────────────────────────────────────
const testimonialSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    meta: { type: localizedSchema, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    quote: { type: localizedSchema, required: true },
    image: { type: String, required: true },
    wide: { type: Boolean, default: false },
    featured: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    publishedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);
export type Testimonial = InferSchemaType<typeof testimonialSchema>;
export type TestimonialDoc = HydratedDocument<Testimonial>;
export const TestimonialModel = defineModel("Testimonial", testimonialSchema);

// ─── FAQ ──────────────────────────────────────────────────────────────────
const faqSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    question: { type: localizedSchema, required: true },
    answer: { type: localizedSchema, required: true },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
export type Faq = InferSchemaType<typeof faqSchema>;
export type FaqDoc = HydratedDocument<Faq>;
export const FaqModel = defineModel("Faq", faqSchema);

// ─── Legal document ───────────────────────────────────────────────────────
const legalSectionSchema = new Schema(
  { heading: { type: localizedSchema, required: true }, body: { type: localizedSchema, required: true } },
  { _id: false },
);
const legalDocSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: localizedSchema, required: true },
    effectiveDate: { type: Date, default: () => new Date() },
    sections: { type: [legalSectionSchema], default: [] },
    seo: { type: seoMetaSchema, required: false },
  },
  { timestamps: true },
);
export type LegalDoc = InferSchemaType<typeof legalDocSchema>;
export type LegalDocDoc = HydratedDocument<LegalDoc>;
export const LegalDocModel = defineModel("LegalDoc", legalDocSchema);

// ─── SEO-managed static page ──────────────────────────────────────────────
export const PAGE_KEYS = [
  "home",
  "about",
  "shop",
  "consultancy",
  "contact",
  "testimonials",
] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

const pageSchema = new Schema(
  {
    key: { type: String, enum: PAGE_KEYS, required: true, unique: true },
    /** path WITHOUT locale prefix, e.g. `/`, `/about` */
    path: { type: String, required: true },
    seo: { type: seoMetaSchema, required: false },
    blocks: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
export type Page = InferSchemaType<typeof pageSchema>;
export type PageDoc = HydratedDocument<Page>;
export const PageModel = defineModel("Page", pageSchema);
