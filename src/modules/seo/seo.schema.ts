import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import { env } from "../../config/env.js";
import type { ResolvedSeo, SeoMeta } from "./seo.model.js";
import { buildSitemapEntries, type SitemapEntry } from "./sitemap.service.js";
import { SiteSettingsModel, RedirectModel } from "./site-settings.model.js";
import { AnnouncementModel, type AnnouncementDoc } from "./announcement.model.js";
import { resolveSeo } from "./seo.service.js";
import { ProductModel } from "../catalog/product.model.js";
import { LegalDocModel, PageModel } from "../content/content.model.js";
import { pickLocale } from "../../shared/localized.js";

// ─── ResolvedSeo (output) ─────────────────────────────────────────────────
export const ResolvedSeoRef = builder.objectRef<ResolvedSeo>("ResolvedSeo").implement({
  description: "SEO metadata with all fallbacks applied — safe to render directly.",
  fields: (t) => ({
    title: t.field({ type: LocalizedStringRef, resolve: (s) => s.title }),
    description: t.field({ type: LocalizedStringRef, resolve: (s) => s.description }),
    ogImage: t.exposeString("ogImage", { nullable: true }),
    canonicalPath: t.exposeString("canonicalPath"),
    noindex: t.exposeBoolean("noindex"),
    keywords: t.exposeStringList("keywords"),
    structuredData: t.field({
      type: "JSON",
      nullable: true,
      resolve: (s) => s.structuredData ?? null,
    }),
  }),
});

/**
 * The raw, unresolved override — as opposed to `ResolvedSeo`, which has every
 * fallback already applied. Admin edit forms read this (never `seo`, which
 * would make the current fallback look like an explicit override and freeze
 * it in place on the next save).
 */
export const SeoMetaRawRef = builder.objectRef<SeoMeta>("SeoMetaRaw").implement({
  fields: (t) => ({
    metaTitle: t.field({
      type: LocalizedStringRef,
      nullable: true,
      resolve: (s) => s.metaTitle ?? null,
    }),
    metaDescription: t.field({
      type: LocalizedStringRef,
      nullable: true,
      resolve: (s) => s.metaDescription ?? null,
    }),
    ogImage: t.exposeString("ogImage", { nullable: true }),
    canonicalPath: t.exposeString("canonicalPath", { nullable: true }),
    noindex: t.exposeBoolean("noindex"),
    keywords: t.exposeStringList("keywords"),
  }),
});

// ─── SeoMeta input (admin writes) ────────────────────────────────────────
const LocalizedInput = builder.inputType("LocalizedStringInput", {
  fields: (t) => ({ en: t.string({ required: true }), hi: t.string({ required: true }) }),
});

export const SeoMetaInput = builder.inputType("SeoMetaInput", {
  fields: (t) => ({
    metaTitle: t.field({ type: LocalizedInput, required: false }),
    metaDescription: t.field({ type: LocalizedInput, required: false }),
    ogImage: t.string({ required: false }),
    canonicalPath: t.string({ required: false }),
    noindex: t.boolean({ required: false }),
    keywords: t.stringList({ required: false }),
  }),
});

// ─── SitemapEntry ────────────────────────────────────────────────────────
const SitemapAlternateRef = builder
  .objectRef<SitemapEntry["alternates"][number]>("SitemapAlternate")
  .implement({
    fields: (t) => ({
      hreflang: t.exposeString("hreflang"),
      href: t.exposeString("href"),
    }),
  });

const SitemapEntryRef = builder.objectRef<SitemapEntry>("SitemapEntry").implement({
  fields: (t) => ({
    path: t.exposeString("path"),
    loc: t.exposeString("loc"),
    changefreq: t.exposeString("changefreq"),
    priority: t.exposeFloat("priority"),
    lastmod: t.exposeString("lastmod", { nullable: true }),
    alternates: t.field({ type: [SitemapAlternateRef], resolve: (e) => e.alternates }),
  }),
});

// ─── SiteSettings ────────────────────────────────────────────────────────
type SiteSettingsShape = InstanceType<typeof SiteSettingsModel>;

const SocialLinkRef = builder
  .objectRef<{ label: string; href: string; icon: string }>("SocialLink")
  .implement({
    fields: (t) => ({
      label: t.exposeString("label"),
      href: t.exposeString("href"),
      icon: t.exposeString("icon"),
    }),
  });

export const SiteSettingsRef = builder.objectRef<SiteSettingsShape>("SiteSettings").implement({
  fields: (t) => ({
    name: t.exposeString("name"),
    legalName: t.exposeString("legalName"),
    domain: t.exposeString("domain"),
    logoUrl: t.exposeString("logoUrl"),
    email: t.exposeString("email"),
    phone: t.exposeString("phone"),
    addressText: t.exposeString("addressText"),
    sameAs: t.exposeStringList("sameAs"),
    socials: t.field({ type: [SocialLinkRef], resolve: (s) => s.socials as any }),
  }),
});

// ─── Redirect ────────────────────────────────────────────────────────────
type RedirectShape = InstanceType<typeof RedirectModel>;
export const RedirectRef = builder.objectRef<RedirectShape>("Redirect").implement({
  fields: (t) => ({
    from: t.exposeString("from"),
    to: t.exposeString("to"),
    statusCode: t.exposeInt("statusCode"),
  }),
});

// ─── Announcement bar ──────────────────────────────────────────────────────
export const AnnouncementRef = builder
  .objectRef<AnnouncementDoc>("Announcement")
  .implement({
    fields: (t) => ({
      enabled: t.exposeBoolean("enabled"),
      text: t.field({ type: LocalizedStringRef, resolve: (a) => a.text }),
      linkHref: t.exposeString("linkHref", { nullable: true }),
      linkLabel: t.field({
        type: LocalizedStringRef,
        nullable: true,
        resolve: (a) => a.linkLabel ?? null,
      }),
    }),
  });

const DEFAULT_ANNOUNCEMENT = {
  enabled: true,
  text: { en: "Trusted by 10,000+ seekers", hi: "10,000+ साधकों का विश्वास" },
  linkHref: "",
  linkLabel: undefined,
} as unknown as AnnouncementDoc;

// ─── Queries ─────────────────────────────────────────────────────────────
export function registerSeoModule() {
  builder.queryFields((t) => ({
    siteSettings: t.field({
      type: SiteSettingsRef,
      resolve: async () => {
        const existing = await SiteSettingsModel.findOne({ key: "default" });
        if (existing) return existing;
        return SiteSettingsModel.create({
          key: "default",
          name: "Vastukosh",
          domain: "vastukosh.com",
          email: "support@vastukosh.com",
        });
      },
    }),

    sitemapEntries: t.field({
      type: [SitemapEntryRef],
      args: { baseUrl: t.arg.string({ required: false }) },
      resolve: (_p, args) => buildSitemapEntries(args.baseUrl ?? env.SITE_URL),
    }),

    redirects: t.field({
      type: [RedirectRef],
      resolve: () => RedirectModel.find().sort({ from: 1 }),
    }),

    announcementBar: t.field({
      type: AnnouncementRef,
      resolve: async () =>
        (await AnnouncementModel.findOne({ key: "default" })) ?? DEFAULT_ANNOUNCEMENT,
    }),

    /**
     * SEO block for any known route so the frontend `generateMetadata` can pull
     * marketing overrides without a deploy.
     */
    seoForPath: t.field({
      type: ResolvedSeoRef,
      nullable: true,
      args: { path: t.arg.string({ required: true }) },
      resolve: async (_p, { path }) => {
        const clean = path.replace(/^\/(en|hi)/, "") || "/";

        const productMatch = /^\/shop\/([a-z0-9-]+)$/.exec(clean);
        if (productMatch) {
          const product = await ProductModel.findOne({ slug: productMatch[1] });
          if (!product) return null;
          return resolveSeo(product.seo, {
            path: clean,
            title: product.name,
            description: product.description,
            ogImage: product.image,
          });
        }

        const legalMatch = /^\/legal\/([a-z0-9-]+)$/.exec(clean);
        if (legalMatch) {
          const doc = await LegalDocModel.findOne({ slug: legalMatch[1] });
          if (!doc) return null;
          return resolveSeo(doc.seo, {
            path: clean,
            title: doc.title,
            description: {
              en: pickLocale(doc.sections[0]?.body, "en").slice(0, 200),
              hi: pickLocale(doc.sections[0]?.body, "hi").slice(0, 200),
            },
          });
        }

        const page = await PageModel.findOne({ path: clean });
        if (page) {
          return resolveSeo(page.seo, {
            path: clean,
            title: { en: "Vastukosh", hi: "वास्तुकोष" },
            description: { en: "", hi: "" },
          });
        }
        return null;
      },
    }),
  }));
}
