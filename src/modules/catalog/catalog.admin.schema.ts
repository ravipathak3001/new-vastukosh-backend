import { builder } from "../../graphql/builder.js";
import { resolvePaging, paged, type Paged } from "../../graphql/admin-common.js";
import { SeoMetaInput, SeoMetaRawRef } from "../seo/seo.schema.js";
import type { SeoMeta } from "../seo/seo.model.js";
import type { ProductDoc } from "./product.model.js";
import {
  ProductRef,
  ProductCategory,
  ProductNeed,
  ProductStatusEnum,
  CollectionRef,
} from "./catalog.schema.js";
import {
  deleteCollection,
  getProductForAdmin,
  listCollectionsForAdmin,
  listProductsForAdmin,
  setProductStatus,
  upsertCollection,
  type AdminProductFilter,
} from "./catalog.service.js";

const AdminProductFilterInput = builder.inputType("AdminProductFilterInput", {
  fields: (t) => ({
    status: t.field({ type: ProductStatusEnum, required: false }),
    category: t.field({ type: ProductCategory, required: false }),
    search: t.string({ required: false }),
  }),
});

const AdminProductPage = builder
  .objectRef<Paged<ProductDoc>>("AdminProductPage")
  .implement({
    fields: (t) => ({
      items: t.field({ type: [ProductRef], resolve: (p) => p.items }),
      total: t.exposeInt("total"),
      page: t.exposeInt("page"),
      pageSize: t.exposeInt("pageSize"),
    }),
  });

const CollectionFilterInput = builder.inputType("CollectionFilterInput", {
  fields: (t) => ({
    category: t.field({ type: ProductCategory, required: false }),
    need: t.field({ type: ProductNeed, required: false }),
    rashi: t.string({ required: false }),
  }),
});

type CollectionFilterShape = {
  category?: string | null;
  need?: string | null;
  rashi?: string | null;
};

const CollectionFilterRef = builder
  .objectRef<CollectionFilterShape>("CollectionFilter")
  .implement({
    fields: (t) => ({
      category: t.field({
        type: ProductCategory,
        nullable: true,
        resolve: (f) => (f.category ?? null) as never,
      }),
      need: t.field({
        type: ProductNeed,
        nullable: true,
        resolve: (f) => (f.need ?? null) as never,
      }),
      rashi: t.string({ nullable: true, resolve: (f) => f.rashi ?? null }),
    }),
  });

// `filter` is the collection's write-only targeting rule — surfaced here
// (admin-only) so the edit form can round-trip the current value instead of
// re-specifying it blind on every save.
builder.objectField(CollectionRef, "filter", (t) =>
  t.field({
    type: CollectionFilterRef,
    nullable: true,
    authScopes: { admin: true },
    resolve: (c) => (c as { filter?: CollectionFilterShape }).filter ?? null,
  }),
);

// Raw (unresolved) SEO overrides — see `SeoMetaRawRef`.
builder.objectField(ProductRef, "seoRaw", (t) =>
  t.field({
    type: SeoMetaRawRef,
    nullable: true,
    authScopes: { admin: true },
    resolve: (p) => (p as { seo?: SeoMeta }).seo ?? null,
  }),
);
builder.objectField(CollectionRef, "seoRaw", (t) =>
  t.field({
    type: SeoMetaRawRef,
    nullable: true,
    authScopes: { admin: true },
    resolve: (c) => (c as { seo?: SeoMeta }).seo ?? null,
  }),
);

const CollectionInput = builder.inputType("CollectionInput", {
  fields: (t) => ({
    slug: t.string({ required: true }),
    title: t.field({ type: "JSON", required: false }),
    description: t.field({ type: "JSON", required: false }),
    filter: t.field({ type: CollectionFilterInput, required: false }),
    heroImage: t.string({ required: false }),
    order: t.int({ required: false }),
    published: t.boolean({ required: false }),
    seo: t.field({ type: SeoMetaInput, required: false }),
  }),
});

export function registerCatalogAdminModule() {
  builder.queryFields((t) => ({
    adminProducts: t.field({
      type: AdminProductPage,
      authScopes: { admin: true },
      args: {
        filter: t.arg({ type: AdminProductFilterInput, required: false }),
        page: t.arg.int({ required: false }),
        pageSize: t.arg.int({ required: false }),
      },
      resolve: async (_p, args) => {
        const { page, pageSize, skip, limit } = resolvePaging(args);
        const filter: AdminProductFilter = {
          status: args.filter?.status ?? null,
          category: args.filter?.category ?? null,
          search: args.filter?.search ?? null,
        };
        const { items, total } = await listProductsForAdmin(filter, skip, limit);
        return paged(items, total, { page, pageSize });
      },
    }),

    adminProduct: t.field({
      type: ProductRef,
      nullable: true,
      authScopes: { admin: true },
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }) => getProductForAdmin(slug).catch(() => null),
    }),

    adminCollections: t.field({
      type: [CollectionRef],
      authScopes: { admin: true },
      resolve: () => listCollectionsForAdmin(),
    }),
  }));

  builder.mutationFields((t) => ({
    restoreProduct: t.field({
      type: ProductRef,
      authScopes: { admin: true },
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }) => setProductStatus(slug, "active"),
    }),

    upsertCollection: t.field({
      type: CollectionRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: CollectionInput, required: true }) },
      resolve: (_p, { input }) => upsertCollection(input as never),
    }),

    deleteCollection: t.field({
      type: "Boolean",
      authScopes: { admin: true },
      args: { slug: t.arg.string({ required: true }) },
      resolve: async (_p, { slug }) => {
        await deleteCollection(slug);
        return true;
      },
    }),
  }));
}
