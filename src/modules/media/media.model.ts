import { Schema, Types, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

/** Library folders an image can be filed under — purely for organising / filtering in the admin. */
export const MEDIA_FOLDERS = [
  "products",
  "collections",
  "content",
  "daily",
  "experts",
  "general",
] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

export const MEDIA_STORAGES = ["local", "cloudinary"] as const;

/**
 * One uploaded image. The file itself lives with the storage provider
 * (`media.storage.ts`); this record is the library entry the admin browses,
 * and `url` is what gets pasted into products, collections, testimonials…
 */
const mediaAssetSchema = new Schema(
  {
    /** Provider-side id: the relative file path (local) or the public_id (Cloudinary). */
    storageKey: { type: String, required: true, unique: true },
    storage: { type: String, enum: MEDIA_STORAGES, required: true },
    url: { type: String, required: true, index: true },
    filename: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    folder: { type: String, enum: MEDIA_FOLDERS, default: "general", index: true },
    alt: { type: String, default: "", trim: true },
    uploadedBy: { type: Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
mediaAssetSchema.index({ createdAt: -1 });

export type MediaAsset = InferSchemaType<typeof mediaAssetSchema>;
export type MediaAssetDoc = HydratedDocument<MediaAsset>;
export const MediaAssetModel = defineModel("MediaAsset", mediaAssetSchema);
