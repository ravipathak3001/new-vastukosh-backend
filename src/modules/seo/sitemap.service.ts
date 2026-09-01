import { LOCALES } from "../../shared/localized.js";
import { env } from "../../config/env.js";
import { ProductModel } from "../catalog/product.model.js";
import { CollectionModel } from "../catalog/collection.model.js";
import { LegalDocModel, PageModel } from "../content/content.model.js";

export type SitemapAlternate = { hreflang: string; href: string };

export type SitemapEntry = {
  /** locale-prefixed path, e.g. `/en/shop/sacred-crystal-ganesha` */
  path: string;
  loc: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
  lastmod: string | null;
  alternates: SitemapAlternate[];
};

const STATIC_ROUTES: { path: string; changefreq: SitemapEntry["changefreq"]; priority: number }[] = [
  { path: "/", changefreq: "weekly", priority: 1 },
  { path: "/about", changefreq: "monthly", priority: 0.6 },
  { path: "/shop", changefreq: "daily", priority: 0.9 },
  { path: "/consultancy", changefreq: "monthly", priority: 0.8 },
  { path: "/testimonials", changefreq: "monthly", priority: 0.5 },
  { path: "/contact", changefreq: "yearly", priority: 0.4 },
];

function buildEntry(
  baseUrl: string,
  routePath: string,
  changefreq: SitemapEntry["changefreq"],
  priority: number,
  lastmod: Date | null,
): SitemapEntry[] {
  const base = baseUrl.replace(/\/$/, "");
  const alternates: SitemapAlternate[] = LOCALES.map((l) => ({
    hreflang: l,
    href: `${base}/${l}${routePath === "/" ? "" : routePath}`,
  }));
  alternates.push({ hreflang: "x-default", href: `${base}/en${routePath === "/" ? "" : routePath}` });

  return LOCALES.map((locale) => {
    const path = `/${locale}${routePath === "/" ? "" : routePath}`;
    return {
      path,
      loc: `${base}${path}`,
      changefreq,
      priority,
      lastmod: lastmod ? lastmod.toISOString() : null,
      alternates,
    };
  });
}

/**
 * Every indexable URL × locale, with hreflang alternates. Consumed by the
 * frontend's `app/sitemap.ts`. `noindex` entities are excluded.
 */
export async function buildSitemapEntries(baseUrl = env.SITE_URL): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  for (const r of STATIC_ROUTES) {
    entries.push(...buildEntry(baseUrl, r.path, r.changefreq, r.priority, null));
  }

  const products = await ProductModel.find({ status: "active" }).select(
    "slug updatedAt seo.noindex",
  );
  for (const p of products) {
    if (p.seo?.noindex) continue;
    entries.push(
      ...buildEntry(baseUrl, `/shop/${p.slug}`, "weekly", 0.7, p.updatedAt ?? null),
    );
  }

  const collections = await CollectionModel.find({ published: true }).select(
    "slug updatedAt seo.noindex",
  );
  for (const c of collections) {
    if (c.seo?.noindex) continue;
    entries.push(
      ...buildEntry(baseUrl, `/shop/collection/${c.slug}`, "weekly", 0.6, c.updatedAt ?? null),
    );
  }

  const legal = await LegalDocModel.find().select("slug updatedAt seo.noindex");
  for (const d of legal) {
    if (d.seo?.noindex) continue;
    entries.push(
      ...buildEntry(baseUrl, `/legal/${d.slug}`, "yearly", 0.3, d.updatedAt ?? null),
    );
  }

  // `Page` overrides can flip a static route to noindex.
  const pages = await PageModel.find().select("path seo.noindex");
  const noindexPaths = new Set(pages.filter((p) => p.seo?.noindex).map((p) => p.path));
  return entries.filter((e) => {
    const routePath = e.path.replace(/^\/(en|hi)/, "") || "/";
    return !noindexPaths.has(routePath);
  });
}

export async function listRedirects() {
  const { RedirectModel } = await import("./site-settings.model.js");
  return RedirectModel.find().sort({ from: 1 });
}
