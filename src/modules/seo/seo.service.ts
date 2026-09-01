import type { LocalizedString } from "../../shared/localized.js";
import type { ResolvedSeo, SeoMeta } from "./seo.model.js";

const BRAND_SUFFIX: LocalizedString = { en: " · Vastukosh", hi: " · वास्तुकोष" };

function withBrand(title: LocalizedString): LocalizedString {
  return {
    en: title.en.endsWith(BRAND_SUFFIX.en) ? title.en : title.en + BRAND_SUFFIX.en,
    hi: title.hi.endsWith(BRAND_SUFFIX.hi) ? title.hi : title.hi + BRAND_SUFFIX.hi,
  };
}

function clampDescription(value: LocalizedString): LocalizedString {
  const clamp = (s: string) => (s.length > 320 ? `${s.slice(0, 317)}…` : s);
  return { en: clamp(value.en), hi: clamp(value.hi) };
}

export type SeoFallbacks = {
  /** Path WITHOUT the locale prefix, e.g. `/shop/sacred-crystal-ganesha`. */
  path: string;
  title: LocalizedString;
  description: LocalizedString;
  ogImage?: string | null;
};

/**
 * Merge an entity's optional SeoMeta with fallbacks derived from the entity so
 * every consumer (frontend `generateMetadata`, sitemap, JSON-LD) gets a complete
 * object. This is the single place SEO defaulting logic lives.
 */
export function resolveSeo(
  meta: SeoMeta | null | undefined,
  fallback: SeoFallbacks,
): ResolvedSeo {
  const title = meta?.metaTitle ?? withBrand(fallback.title);
  const description = clampDescription(
    meta?.metaDescription ?? fallback.description,
  );

  return {
    title,
    description,
    ogImage: meta?.ogImage ?? fallback.ogImage ?? null,
    canonicalPath: meta?.canonicalPath ?? fallback.path,
    noindex: meta?.noindex ?? false,
    keywords: meta?.keywords ?? [],
    structuredData: meta?.structuredData ?? null,
  };
}
