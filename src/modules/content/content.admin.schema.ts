import { builder } from "../../graphql/builder.js";
import { PAGE_KEYS } from "./content.model.js";
import {
  FaqRef,
  LegalDocRef,
  PageRef,
  TestimonialRef,
} from "./content.schema.js";
import { SeoMetaInput, SeoMetaRawRef } from "../seo/seo.schema.js";
import type { SeoMeta } from "../seo/seo.model.js";
import {
  deleteFaq,
  deleteLegalDoc,
  deleteTestimonial,
  listFaqsForAdmin,
  listLegalDocsForAdmin,
  listPagesForAdmin,
  listTestimonialsForAdmin,
  upsertFaq,
  upsertLegalDoc,
  upsertPage,
  upsertTestimonial,
} from "./content.service.js";

const PageKeyEnum = builder.enumType("PageKey", { values: PAGE_KEYS });

// Raw (unresolved) SEO overrides — see `SeoMetaRawRef` for why the admin form
// reads these instead of the fallback-resolved `seo` field.
builder.objectField(PageRef, "seoRaw", (t) =>
  t.field({
    type: SeoMetaRawRef,
    nullable: true,
    authScopes: { admin: true },
    resolve: (p) => (p as { seo?: SeoMeta }).seo ?? null,
  }),
);
builder.objectField(LegalDocRef, "seoRaw", (t) =>
  t.field({
    type: SeoMetaRawRef,
    nullable: true,
    authScopes: { admin: true },
    resolve: (d) => (d as { seo?: SeoMeta }).seo ?? null,
  }),
);

const TestimonialInput = builder.inputType("TestimonialInput", {
  fields: (t) => ({
    key: t.string({ required: true }),
    name: t.string({ required: true }),
    meta: t.field({ type: "JSON", required: false }),
    rating: t.int({ required: true }),
    quote: t.field({ type: "JSON", required: false }),
    image: t.string({ required: true }),
    wide: t.boolean({ required: false }),
    featured: t.boolean({ required: false }),
    order: t.int({ required: false }),
  }),
});

const FaqInput = builder.inputType("FaqInput", {
  fields: (t) => ({
    key: t.string({ required: true }),
    question: t.field({ type: "JSON", required: false }),
    answer: t.field({ type: "JSON", required: false }),
    order: t.int({ required: false }),
    published: t.boolean({ required: false }),
  }),
});

const LegalSectionInput = builder.inputType("LegalSectionInput", {
  fields: (t) => ({
    heading: t.field({ type: "JSON", required: true }),
    body: t.field({ type: "JSON", required: true }),
  }),
});

const LegalDocInput = builder.inputType("LegalDocInput", {
  fields: (t) => ({
    slug: t.string({ required: true }),
    title: t.field({ type: "JSON", required: false }),
    effectiveDate: t.field({ type: "DateTime", required: false }),
    sections: t.field({ type: [LegalSectionInput], required: false }),
    seo: t.field({ type: SeoMetaInput, required: false }),
  }),
});

const PageInput = builder.inputType("PageInput", {
  fields: (t) => ({
    key: t.field({ type: PageKeyEnum, required: true }),
    path: t.string({ required: false }),
    seo: t.field({ type: SeoMetaInput, required: false }),
    blocks: t.field({ type: "JSON", required: false }),
  }),
});

export function registerContentAdminModule() {
  builder.queryFields((t) => ({
    adminTestimonials: t.field({
      type: [TestimonialRef],
      authScopes: { admin: true },
      resolve: () => listTestimonialsForAdmin(),
    }),
    adminFaqs: t.field({
      type: [FaqRef],
      authScopes: { admin: true },
      resolve: () => listFaqsForAdmin(),
    }),
    adminLegalDocs: t.field({
      type: [LegalDocRef],
      authScopes: { admin: true },
      resolve: () => listLegalDocsForAdmin(),
    }),
    adminPages: t.field({
      type: [PageRef],
      authScopes: { admin: true },
      resolve: () => listPagesForAdmin(),
    }),
  }));

  builder.mutationFields((t) => ({
    upsertTestimonial: t.field({
      type: TestimonialRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: TestimonialInput, required: true }) },
      resolve: (_p, { input }) => upsertTestimonial(input as never),
    }),
    deleteTestimonial: t.field({
      type: "Boolean",
      authScopes: { admin: true },
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_p, { id }) => {
        await deleteTestimonial(String(id));
        return true;
      },
    }),

    upsertFaq: t.field({
      type: FaqRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: FaqInput, required: true }) },
      resolve: (_p, { input }) => upsertFaq(input as never),
    }),
    deleteFaq: t.field({
      type: "Boolean",
      authScopes: { admin: true },
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_p, { id }) => {
        await deleteFaq(String(id));
        return true;
      },
    }),

    upsertLegalDoc: t.field({
      type: LegalDocRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: LegalDocInput, required: true }) },
      resolve: (_p, { input }) => upsertLegalDoc(input as never),
    }),
    deleteLegalDoc: t.field({
      type: "Boolean",
      authScopes: { admin: true },
      args: { slug: t.arg.string({ required: true }) },
      resolve: async (_p, { slug }) => {
        await deleteLegalDoc(slug);
        return true;
      },
    }),

    upsertPage: t.field({
      type: PageRef,
      authScopes: { admin: true },
      args: { input: t.arg({ type: PageInput, required: true }) },
      resolve: (_p, { input }) => upsertPage(input as never),
    }),
  }));
}
