import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

/**
 * Singleton document (`key: "default"`) holding the organisation-level facts the
 * frontend needs for Organization / WebSite JSON-LD and the footer.
 */
const socialSchema = new Schema(
  { label: { type: String, required: true }, href: { type: String, required: true }, icon: { type: String, default: "" } },
  { _id: false },
);

const siteSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    name: { type: String, required: true },
    legalName: { type: String, default: "" },
    domain: { type: String, required: true },
    logoUrl: { type: String, default: "" },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    addressText: { type: String, default: "" },
    socials: { type: [socialSchema], default: [] },
    /** absolute URLs for schema.org `sameAs` */
    sameAs: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type SiteSettings = InferSchemaType<typeof siteSettingsSchema>;
export type SiteSettingsDoc = HydratedDocument<SiteSettings>;
export const SiteSettingsModel = defineModel("SiteSettings", siteSettingsSchema);

// ─── Redirect ─────────────────────────────────────────────────────────────
const redirectSchema = new Schema(
  {
    from: { type: String, required: true, unique: true },
    to: { type: String, required: true },
    statusCode: { type: Number, enum: [301, 302], default: 301 },
  },
  { timestamps: true },
);
export type Redirect = InferSchemaType<typeof redirectSchema>;
export type RedirectDoc = HydratedDocument<Redirect>;
export const RedirectModel = defineModel("Redirect", redirectSchema);
