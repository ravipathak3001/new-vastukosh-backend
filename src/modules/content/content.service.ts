import { notFound } from "../../shared/errors.js";
import { notifyFrontendRevalidate } from "../../shared/http/revalidate-client.js";
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

// ─── Admin: testimonials ──────────────────────────────────────────────────

export async function listTestimonialsForAdmin(): Promise<TestimonialDoc[]> {
  return TestimonialModel.find().sort({ order: 1 });
}

export async function upsertTestimonial(
  input: { key: string } & Record<string, unknown>,
): Promise<TestimonialDoc> {
  const doc = await TestimonialModel.findOneAndUpdate(
    { key: input.key },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await notifyFrontendRevalidate(["content"]);
  return doc;
}

export async function deleteTestimonial(id: string): Promise<void> {
  const doc = await TestimonialModel.findByIdAndDelete(id);
  if (!doc) throw notFound("Testimonial");
  await notifyFrontendRevalidate(["content"]);
}

// ─── Admin: FAQs ───────────────────────────────────────────────────────────

export async function listFaqsForAdmin(): Promise<FaqDoc[]> {
  return FaqModel.find().sort({ order: 1 });
}

export async function upsertFaq(
  input: { key: string } & Record<string, unknown>,
): Promise<FaqDoc> {
  const doc = await FaqModel.findOneAndUpdate(
    { key: input.key },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await notifyFrontendRevalidate(["content"]);
  return doc;
}

export async function deleteFaq(id: string): Promise<void> {
  const doc = await FaqModel.findByIdAndDelete(id);
  if (!doc) throw notFound("FAQ");
  await notifyFrontendRevalidate(["content"]);
}

// ─── Admin: legal docs ─────────────────────────────────────────────────────

export async function listLegalDocsForAdmin(): Promise<LegalDocDoc[]> {
  return LegalDocModel.find().sort({ slug: 1 });
}

export async function getLegalDocForAdmin(slug: string): Promise<LegalDocDoc> {
  const doc = await LegalDocModel.findOne({ slug });
  if (!doc) throw notFound("Legal document");
  return doc;
}

export async function upsertLegalDoc(
  input: { slug: string } & Record<string, unknown>,
): Promise<LegalDocDoc> {
  const doc = await LegalDocModel.findOneAndUpdate(
    { slug: input.slug },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await notifyFrontendRevalidate(["content", `legal:${doc.slug}`]);
  return doc;
}

export async function deleteLegalDoc(slug: string): Promise<void> {
  const doc = await LegalDocModel.findOneAndDelete({ slug });
  if (!doc) throw notFound("Legal document");
  await notifyFrontendRevalidate(["content"]);
}

// ─── Admin: pages ──────────────────────────────────────────────────────────

export async function listPagesForAdmin(): Promise<PageDoc[]> {
  return PageModel.find().sort({ key: 1 });
}

export async function upsertPage(
  input: { key: string } & Record<string, unknown>,
): Promise<PageDoc> {
  const doc = await PageModel.findOneAndUpdate(
    { key: input.key },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await notifyFrontendRevalidate(["content", `page:${doc.key}`]);
  return doc;
}
