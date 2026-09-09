import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import { resolveSeo } from "../seo/seo.service.js";
import { ResolvedSeoRef } from "../seo/seo.schema.js";
import { pickLocale } from "../../shared/localized.js";
import {
  FaqModel,
  LegalDocModel,
  PageModel,
  TestimonialModel,
  type FaqDoc,
  type LegalDocDoc,
  type PageDoc,
  type TestimonialDoc,
} from "./content.model.js";

export const TestimonialRef = builder.objectRef<TestimonialDoc>("Testimonial").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (d) => String(d._id) }),
    key: t.exposeString("key", { authScopes: { permission: "content.view" } }),
    name: t.exposeString("name"),
    meta: t.field({ type: LocalizedStringRef, resolve: (d) => d.meta }),
    rating: t.exposeInt("rating"),
    quote: t.field({ type: LocalizedStringRef, resolve: (d) => d.quote }),
    image: t.exposeString("image"),
    wide: t.exposeBoolean("wide"),
    featured: t.exposeBoolean("featured"),
    order: t.exposeInt("order", { authScopes: { permission: "content.view" } }),
  }),
});

export const FaqRef = builder.objectRef<FaqDoc>("Faq").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (d) => String(d._id) }),
    key: t.exposeString("key", { authScopes: { permission: "content.view" } }),
    question: t.field({ type: LocalizedStringRef, resolve: (d) => d.question }),
    answer: t.field({ type: LocalizedStringRef, resolve: (d) => d.answer }),
    order: t.exposeInt("order"),
    published: t.exposeBoolean("published", { authScopes: { permission: "content.view" } }),
  }),
});

export const LegalSectionRef = builder
  .objectRef<LegalDocDoc["sections"][number]>("LegalSection")
  .implement({
    fields: (t) => ({
      heading: t.field({ type: LocalizedStringRef, resolve: (s) => s.heading }),
      body: t.field({ type: LocalizedStringRef, resolve: (s) => s.body }),
    }),
  });

export const LegalDocRef = builder.objectRef<LegalDocDoc>("LegalDoc").implement({
  fields: (t) => ({
    slug: t.exposeString("slug"),
    title: t.field({ type: LocalizedStringRef, resolve: (d) => d.title }),
    effectiveDate: t.field({ type: "DateTime", resolve: (d) => d.effectiveDate }),
    sections: t.field({ type: [LegalSectionRef], resolve: (d) => d.sections }),
    seo: t.field({
      type: ResolvedSeoRef,
      resolve: (d) =>
        resolveSeo(d.seo, {
          path: `/legal/${d.slug}`,
          title: d.title,
          description: {
            en: pickLocale(d.sections[0]?.body, "en").slice(0, 200),
            hi: pickLocale(d.sections[0]?.body, "hi").slice(0, 200),
          },
        }),
    }),
  }),
});

export const PageRef = builder.objectRef<PageDoc>("Page").implement({
  fields: (t) => ({
    key: t.exposeString("key"),
    path: t.exposeString("path"),
    seo: t.field({
      type: ResolvedSeoRef,
      resolve: (p) =>
        resolveSeo(p.seo, {
          path: p.path,
          title: { en: "Vastukosh", hi: "वास्तुकोष" },
          description: { en: "", hi: "" },
        }),
    }),
    blocks: t.field({ type: "JSON", nullable: true, resolve: (p) => p.blocks ?? null }),
  }),
});

export function registerContentModule() {
  builder.queryFields((t) => ({
    testimonials: t.field({
      type: [TestimonialRef],
      args: { featuredOnly: t.arg.boolean({ required: false }) },
      resolve: (_p, args) =>
        TestimonialModel.find(args.featuredOnly ? { featured: true } : {})
          .sort({ order: 1 })
          .exec(),
    }),
    faqs: t.field({
      type: [FaqRef],
      resolve: () => FaqModel.find({ published: true }).sort({ order: 1 }).exec(),
    }),
    legalDocs: t.field({
      type: [LegalDocRef],
      resolve: () => LegalDocModel.find().sort({ slug: 1 }).exec(),
    }),
    legalDoc: t.field({
      type: LegalDocRef,
      nullable: true,
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }) => LegalDocModel.findOne({ slug }).exec(),
    }),
    page: t.field({
      type: PageRef,
      nullable: true,
      args: { key: t.arg.string({ required: true }) },
      resolve: (_p, { key }) => PageModel.findOne({ key }).exec(),
    }),
  }));
}
