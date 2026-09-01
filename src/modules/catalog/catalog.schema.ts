import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import { resolveSeo } from "../seo/seo.service.js";
import { ResolvedSeoRef } from "../seo/seo.schema.js";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_NEEDS,
  type ProductDoc,
} from "./product.model.js";
import type { RashiDoc } from "./rashi.model.js";
import type { CollectionDoc } from "./collection.model.js";
import {
  getCollectionBySlug,
  getProductBySlug,
  listCollections,
  listProducts,
  listRashis,
  productsForCollection,
  relatedProducts,
  upsertProduct,
  archiveProduct,
  type ProductFilter,
  type ProductSort,
} from "./catalog.service.js";
import { ProductModel } from "./product.model.js";
import { SeoMetaInput } from "../seo/seo.schema.js";

const ProductCategory = builder.enumType("ProductCategory", { values: PRODUCT_CATEGORIES });
const ProductNeed = builder.enumType("ProductNeed", { values: PRODUCT_NEEDS });
const ProductSortEnum = builder.enumType("ProductSort", {
  values: ["recommended", "price_asc", "price_desc", "rating", "newest"] as const,
});

const ProductDetailRef = builder
  .objectRef<ProductDoc["details"][number]>("ProductDetail")
  .implement({
    fields: (t) => ({
      title: t.field({ type: LocalizedStringRef, resolve: (d) => d.title }),
      body: t.field({ type: LocalizedStringRef, resolve: (d) => d.body }),
    }),
  });

export const ProductRef = builder.objectRef<ProductDoc>("Product");
ProductRef.implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (p) => String(p._id) }),
    slug: t.exposeString("slug"),
    name: t.field({ type: LocalizedStringRef, resolve: (p) => p.name }),
    tagline: t.field({ type: LocalizedStringRef, resolve: (p) => p.tagline }),
    description: t.field({ type: LocalizedStringRef, resolve: (p) => p.description }),
    price: t.exposeFloat("price"),
    mrp: t.exposeFloat("mrp", { nullable: true }),
    currency: t.exposeString("currency"),
    rating: t.exposeFloat("rating"),
    reviewsCount: t.exposeInt("reviewsCount"),
    category: t.field({ type: ProductCategory, resolve: (p) => p.category as never }),
    rashis: t.exposeStringList("rashis"),
    needs: t.field({ type: [ProductNeed], resolve: (p) => p.needs as never[] }),
    image: t.exposeString("image"),
    gallery: t.exposeStringList("gallery"),
    featured: t.exposeBoolean("featured"),
    highlights: t.field({ type: [LocalizedStringRef], resolve: (p) => p.highlights }),
    details: t.field({ type: [ProductDetailRef], resolve: (p) => p.details }),
    seo: t.field({
      type: ResolvedSeoRef,
      resolve: (p) =>
        resolveSeo(p.seo, {
          path: `/shop/${p.slug}`,
          title: p.name,
          description: p.description,
          ogImage: p.image,
        }),
    }),
    relatedProducts: t.field({
      type: [ProductRef],
      args: { limit: t.arg.int({ required: false }) },
      resolve: (p, args) => relatedProducts(p.slug, args.limit ?? 4),
    }),
  }),
});

const ProductPageRef = builder
  .objectRef<{ items: ProductDoc[]; total: number; offset: number; limit: number }>("ProductPage")
  .implement({
    fields: (t) => ({
      items: t.field({ type: [ProductRef], resolve: (p) => p.items }),
      total: t.exposeInt("total"),
      hasMore: t.boolean({ resolve: (p) => p.offset + p.items.length < p.total }),
    }),
  });

export const RashiRef = builder.objectRef<RashiDoc>("Rashi").implement({
  fields: (t) => ({
    slug: t.exposeString("slug"),
    order: t.exposeInt("order"),
    name: t.field({ type: LocalizedStringRef, resolve: (r) => r.name }),
    western: t.exposeString("western"),
    symbol: t.exposeString("symbol"),
    image: t.exposeString("image"),
  }),
});

const CollectionRef = builder.objectRef<CollectionDoc>("Collection").implement({
  fields: (t) => ({
    slug: t.exposeString("slug"),
    title: t.field({ type: LocalizedStringRef, resolve: (c) => c.title }),
    description: t.field({ type: LocalizedStringRef, resolve: (c) => c.description }),
    heroImage: t.exposeString("heroImage", { nullable: true }),
    seo: t.field({
      type: ResolvedSeoRef,
      resolve: (c) =>
        resolveSeo(c.seo, {
          path: `/shop/collection/${c.slug}`,
          title: c.title,
          description: c.description,
        }),
    }),
    products: t.field({ type: [ProductRef], resolve: (c) => productsForCollection(c) }),
  }),
});

const ProductFilterInput = builder.inputType("ProductFilterInput", {
  fields: (t) => ({
    category: t.field({ type: ProductCategory, required: false }),
    need: t.field({ type: ProductNeed, required: false }),
    rashi: t.string({ required: false }),
    featured: t.boolean({ required: false }),
    search: t.string({ required: false }),
  }),
});

const ProductInput = builder.inputType("ProductInput", {
  fields: (t) => ({
    slug: t.string({ required: true }),
    name: t.field({ type: "JSON", required: false }),
    tagline: t.field({ type: "JSON", required: false }),
    description: t.field({ type: "JSON", required: false }),
    price: t.float({ required: false }),
    mrp: t.float({ required: false }),
    category: t.field({ type: ProductCategory, required: false }),
    rashis: t.stringList({ required: false }),
    needs: t.field({ type: [ProductNeed], required: false }),
    image: t.string({ required: false }),
    gallery: t.stringList({ required: false }),
    featured: t.boolean({ required: false }),
    seo: t.field({ type: SeoMetaInput, required: false }),
  }),
});

export function registerCatalogModule() {
  builder.queryFields((t) => ({
    products: t.field({
      type: ProductPageRef,
      args: {
        filter: t.arg({ type: ProductFilterInput, required: false }),
        sort: t.arg({ type: ProductSortEnum, required: false }),
        limit: t.arg.int({ required: false }),
        offset: t.arg.int({ required: false }),
      },
      resolve: async (_p, args) => {
        const filter = (args.filter ?? {}) as ProductFilter;
        const sort = (args.sort ?? "recommended") as ProductSort;
        const limit = Math.min(Math.max(args.limit ?? 24, 1), 60);
        const offset = Math.max(args.offset ?? 0, 0);
        const all = await listProducts(filter, sort);
        return { items: all.slice(offset, offset + limit), total: all.length, offset, limit };
      },
    }),

    product: t.field({
      type: ProductRef,
      nullable: true,
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }) => ProductModel.findOne({ slug, status: "active" }),
    }),

    featuredProducts: t.field({
      type: [ProductRef],
      args: { limit: t.arg.int({ required: false }) },
      resolve: async (_p, args) =>
        (await listProducts({ featured: true }, "recommended")).slice(0, args.limit ?? 6),
    }),

    relatedProducts: t.field({
      type: [ProductRef],
      args: { slug: t.arg.string({ required: true }), limit: t.arg.int({ required: false }) },
      resolve: (_p, { slug, limit }) => relatedProducts(slug, limit ?? 4),
    }),

    rashis: t.field({ type: [RashiRef], resolve: () => listRashis() }),

    rashi: t.field({
      type: RashiRef,
      nullable: true,
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }, ctx) => ctx.loaders.rashiBySlug.load(slug),
    }),

    collections: t.field({ type: [CollectionRef], resolve: () => listCollections() }),

    collection: t.field({
      type: CollectionRef,
      nullable: true,
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }) => getCollectionBySlug(slug).catch(() => null),
    }),
  }));

  builder.mutationFields((t) => ({
    upsertProduct: t.field({
      type: ProductRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: ProductInput, required: true }) },
      resolve: (_p, { input }) => upsertProduct(input as never),
    }),
    archiveProduct: t.field({
      type: ProductRef,
      authScopes: { admin: true },
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }) => archiveProduct(slug),
    }),
  }));
}

export { getProductBySlug };
