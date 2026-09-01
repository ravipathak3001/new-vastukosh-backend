import type { FilterQuery } from "mongoose";
import { notFound } from "../../shared/errors.js";
import { notifyFrontendRevalidate } from "../../shared/http/revalidate-client.js";
import {
  ProductModel,
  type Product,
  type ProductCategory,
  type ProductDoc,
  type ProductNeed,
} from "./product.model.js";
import { RashiModel } from "./rashi.model.js";
import { CollectionModel, type CollectionDoc } from "./collection.model.js";

export type ProductFilter = {
  category?: ProductCategory;
  need?: ProductNeed;
  rashi?: string;
  featured?: boolean;
  search?: string;
};

export type ProductSort = "recommended" | "price_asc" | "price_desc" | "rating" | "newest";

const SORT_MAP: Record<ProductSort, Record<string, 1 | -1>> = {
  recommended: { featured: -1, rating: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1 },
  newest: { createdAt: -1 },
};

function toQuery(filter: ProductFilter = {}): FilterQuery<Product> {
  const q: FilterQuery<Product> = { status: "active" };
  if (filter.category) q.category = filter.category;
  if (filter.need) q.needs = filter.need;
  if (filter.rashi) q.rashis = filter.rashi;
  if (typeof filter.featured === "boolean") q.featured = filter.featured;
  if (filter.search?.trim()) {
    const rx = new RegExp(filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    q.$or = [{ "name.en": rx }, { "name.hi": rx }, { "description.en": rx }];
  }
  return q;
}

export async function listProducts(
  filter: ProductFilter = {},
  sort: ProductSort = "recommended",
): Promise<ProductDoc[]> {
  return ProductModel.find(toQuery(filter)).sort(SORT_MAP[sort]);
}

export async function countProducts(filter: ProductFilter = {}): Promise<number> {
  return ProductModel.countDocuments(toQuery(filter));
}

export async function getProductBySlug(slug: string): Promise<ProductDoc> {
  const doc = await ProductModel.findOne({ slug, status: "active" });
  if (!doc) throw notFound("Product");
  return doc;
}

export async function relatedProducts(slug: string, limit = 4): Promise<ProductDoc[]> {
  const product = await ProductModel.findOne({ slug });
  if (!product) return [];
  const sameCategory = await ProductModel.find({
    slug: { $ne: slug },
    status: "active",
    category: product.category,
  }).limit(limit);
  if (sameCategory.length >= limit) return sameCategory;
  const fill = await ProductModel.find({
    slug: { $ne: slug, $nin: sameCategory.map((p) => p.slug) },
    status: "active",
  }).limit(limit - sameCategory.length);
  return [...sameCategory, ...fill];
}

export async function listRashis() {
  return RashiModel.find().sort({ order: 1 });
}

export async function listCollections(): Promise<CollectionDoc[]> {
  return CollectionModel.find({ published: true }).sort({ order: 1 });
}

export async function getCollectionBySlug(slug: string): Promise<CollectionDoc> {
  const doc = await CollectionModel.findOne({ slug, published: true });
  if (!doc) throw notFound("Collection");
  return doc;
}

export async function productsForCollection(collection: CollectionDoc): Promise<ProductDoc[]> {
  return listProducts({
    category: collection.filter?.category as ProductCategory | undefined,
    need: collection.filter?.need as ProductNeed | undefined,
    rashi: collection.filter?.rashi || undefined,
  });
}

// ─── Admin writes ─────────────────────────────────────────────────────────

export async function upsertProduct(
  input: Partial<Product> & { slug: string },
): Promise<ProductDoc> {
  const doc = await ProductModel.findOneAndUpdate(
    { slug: input.slug },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await notifyFrontendRevalidate(["catalog", `product:${doc.slug}`]);
  return doc;
}

export async function archiveProduct(slug: string): Promise<ProductDoc> {
  const doc = await ProductModel.findOneAndUpdate(
    { slug },
    { $set: { status: "archived" } },
    { new: true },
  );
  if (!doc) throw notFound("Product");
  await notifyFrontendRevalidate(["catalog", `product:${slug}`]);
  return doc;
}
