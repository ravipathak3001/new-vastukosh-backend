import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";

/**
 * Editorially-curated "daily" content, all managed from the admin panel:
 *  - DailyMantra  — a mantra with audio the app plays
 *  - DailyVerse   — a Sanskrit shloka with transliteration + meaning
 *  - DailyCard    — a shareable image for WhatsApp status / social
 *  - DailyVastuTip — a short Vastu Shastra tip (website ticker + /vastu-tips)
 *
 * Each doc may pin an explicit `date` (yyyy-mm-dd) to be *the* pick for that
 * day; mantras may also be tied to a weekday. Otherwise a deterministic
 * day-of-year rotation over published docs is used, so every day resolves to
 * something.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateField = {
  type: String,
  default: null,
  validate: {
    validator: (v: string | null) => v == null || v === "" || ISO_DATE.test(v),
    message: "date must be yyyy-mm-dd",
  },
  index: true,
} as const;

// ─── Daily Mantra ─────────────────────────────────────────────────────────
const dailyMantraSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: { type: localizedSchema, required: true },
    deity: { type: String, default: "", trim: true },
    sanskrit: { type: String, default: "", trim: true },
    transliteration: { type: String, default: "", trim: true },
    meaning: { type: localizedSchema, required: true },
    audioUrl: { type: String, default: "", trim: true },
    durationSeconds: { type: Number, default: 0 },
    artwork: { type: String, default: "", trim: true },
    /** 0 = Sunday … 6 = Saturday: the weekday this mantra belongs to (e.g. Tuesday → Hanuman). */
    weekday: { type: Number, default: null, min: 0, max: 6, index: true },
    date: dateField,
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);
export type DailyMantra = InferSchemaType<typeof dailyMantraSchema>;
export type DailyMantraDoc = HydratedDocument<DailyMantra>;
export const DailyMantraModel = defineModel("DailyMantra", dailyMantraSchema);

// ─── Daily Verse ──────────────────────────────────────────────────────────
const dailyVerseSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    sanskrit: { type: String, required: true, trim: true },
    transliteration: { type: String, default: "", trim: true },
    meaning: { type: localizedSchema, required: true },
    source: { type: String, default: "", trim: true },
    date: dateField,
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);
export type DailyVerse = InferSchemaType<typeof dailyVerseSchema>;
export type DailyVerseDoc = HydratedDocument<DailyVerse>;
export const DailyVerseModel = defineModel("DailyVerse", dailyVerseSchema);

// ─── Daily Card (shareable image) ─────────────────────────────────────────
const dailyCardSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: { type: localizedSchema, required: true },
    caption: { type: localizedSchema, required: true },
    imageUrl: { type: String, required: true, trim: true },
    date: dateField,
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);
export type DailyCard = InferSchemaType<typeof dailyCardSchema>;
export type DailyCardDoc = HydratedDocument<DailyCard>;
export const DailyCardModel = defineModel("DailyCard", dailyCardSchema);

// ─── Daily Vastu tip ──────────────────────────────────────────────────────
const dailyVastuTipSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    /** Where in the home it applies, e.g. "Kitchen" / "रसोई". */
    area: { type: localizedSchema, required: true },
    /** One line — what the website ticker shows. */
    title: { type: localizedSchema, required: true },
    body: { type: localizedSchema, required: true },
    /** Material Symbols icon name, e.g. "bed", "explore". */
    icon: { type: String, default: "explore", trim: true },
    image: { type: String, default: "", trim: true },
    date: dateField,
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);
export type DailyVastuTip = InferSchemaType<typeof dailyVastuTipSchema>;
export type DailyVastuTipDoc = HydratedDocument<DailyVastuTip>;
export const DailyVastuTipModel = defineModel("DailyVastuTip", dailyVastuTipSchema);
