import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";

/**
 * Singleton document (`key: "default"`) behind the storefront's announcement
 * bar — the thin strip above the header. Lets marketing change the shloka /
 * promo text without a deploy.
 */
const announcementSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    enabled: { type: Boolean, default: true },
    text: { type: localizedSchema, required: true },
    linkHref: { type: String, default: "" },
    linkLabel: { type: localizedSchema, required: false },
  },
  { timestamps: true },
);

export type Announcement = InferSchemaType<typeof announcementSchema>;
export type AnnouncementDoc = HydratedDocument<Announcement>;
export const AnnouncementModel = defineModel("Announcement", announcementSchema);
