import type { FilterQuery } from "mongoose";
import type { Locale } from "../../shared/localized.js";
import { notFound } from "../../shared/errors.js";
import { searchRegex } from "../../graphql/admin-common.js";
import {
  NewsletterSubscriberModel,
  ContactSubmissionModel,
  type ContactSubmission,
  type ContactSubmissionDoc,
  type NewsletterSubscriber,
  type NewsletterSubscriberDoc,
} from "./marketing.model.js";

export async function subscribeNewsletter(
  email: string,
  locale: Locale,
  source = "footer",
): Promise<{ ok: true }> {
  const normalized = email.toLowerCase().trim();
  await NewsletterSubscriberModel.updateOne(
    { email: normalized },
    { $set: { status: "subscribed", locale, source }, $setOnInsert: { email: normalized } },
    { upsert: true },
  );
  return { ok: true };
}

export async function submitContactForm(input: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  locale: Locale;
}): Promise<{ ok: true }> {
  await ContactSubmissionModel.create({
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    phone: input.phone?.trim() ?? "",
    subject: input.subject?.trim() ?? "",
    message: input.message.trim(),
    locale: input.locale,
  });
  return { ok: true };
}

// ─── Admin: contact submissions ───────────────────────────────────────────

export type AdminContactFilter = { status?: string | null; search?: string | null };

export async function listContactSubmissionsForAdmin(
  filter: AdminContactFilter,
  skip: number,
  limit: number,
): Promise<{ items: ContactSubmissionDoc[]; total: number }> {
  const q: FilterQuery<ContactSubmission> = {};
  if (filter.status) q.status = filter.status as never;
  if (filter.search?.trim()) {
    const rx = searchRegex(filter.search);
    q.$or = [{ name: rx }, { email: rx }, { message: rx }];
  }
  const [items, total] = await Promise.all([
    ContactSubmissionModel.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactSubmissionModel.countDocuments(q),
  ]);
  return { items, total };
}

export async function updateContactStatus(
  id: string,
  status: "new" | "read" | "responded",
): Promise<ContactSubmissionDoc> {
  const doc = await ContactSubmissionModel.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true },
  );
  if (!doc) throw notFound("Contact submission");
  return doc;
}

// ─── Admin: newsletter subscribers ────────────────────────────────────────

export type AdminSubscriberFilter = { status?: string | null; search?: string | null };

export async function listSubscribersForAdmin(
  filter: AdminSubscriberFilter,
  skip: number,
  limit: number,
): Promise<{ items: NewsletterSubscriberDoc[]; total: number }> {
  const q: FilterQuery<NewsletterSubscriber> = {};
  if (filter.status) q.status = filter.status as never;
  if (filter.search?.trim()) {
    q.email = searchRegex(filter.search);
  }
  const [items, total] = await Promise.all([
    NewsletterSubscriberModel.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    NewsletterSubscriberModel.countDocuments(q),
  ]);
  return { items, total };
}

export async function updateSubscriberStatus(
  email: string,
  status: "subscribed" | "unsubscribed",
): Promise<NewsletterSubscriberDoc> {
  const doc = await NewsletterSubscriberModel.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { $set: { status } },
    { new: true },
  );
  if (!doc) throw notFound("Subscriber");
  return doc;
}
