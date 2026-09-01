import { Schema } from "mongoose";
import { localizedSchema, type LocalizedString } from "../../shared/localized.js";

/**
 * Embeddable SEO block. Attached to any indexable entity (Product, LegalDoc,
 * Page, Collection). Every field is optional — `resolveSeo` fills the gaps with
 * sensible fallbacks derived from the host entity.
 */
export type SeoMeta = {
  metaTitle?: LocalizedString;
  metaDescription?: LocalizedString;
  ogImage?: string;
  canonicalPath?: string;
  noindex: boolean;
  keywords: string[];
  structuredData?: unknown;
};

export const seoMetaSchema = new Schema<SeoMeta>(
  {
    metaTitle: { type: localizedSchema, required: false },
    metaDescription: { type: localizedSchema, required: false },
    ogImage: { type: String, trim: true },
    canonicalPath: { type: String, trim: true },
    noindex: { type: Boolean, default: false },
    keywords: { type: [String], default: [] },
    structuredData: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

/** Fully-resolved SEO used by the API response (never has empty required parts). */
export type ResolvedSeo = {
  title: LocalizedString;
  description: LocalizedString;
  ogImage: string | null;
  canonicalPath: string;
  noindex: boolean;
  keywords: string[];
  structuredData: unknown | null;
};
