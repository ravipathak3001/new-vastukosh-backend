import { Schema } from "mongoose";
import { z } from "zod";

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** A string that exists in every supported locale. */
export type LocalizedString = Record<Locale, string>;

/** Reusable embedded Mongoose sub-schema for a localized string. */
export const localizedSchema = new Schema<LocalizedString>(
  {
    en: { type: String, required: true, trim: true, default: "" },
    hi: { type: String, required: true, trim: true, default: "" },
  },
  { _id: false },
);

/** zod validator for localized input. */
export const localizedInput = z.object({
  en: z.string().min(1),
  hi: z.string().min(1),
});

/** Pick one locale's string, falling back to the default locale then any value. */
export function pickLocale(
  value: Partial<LocalizedString> | null | undefined,
  locale: Locale,
): string {
  if (!value) return "";
  return value[locale] ?? value[DEFAULT_LOCALE] ?? Object.values(value)[0] ?? "";
}
