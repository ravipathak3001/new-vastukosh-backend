import crypto from "node:crypto";
import type { FilterQuery } from "mongoose";
import { env } from "../../config/env.js";
import { badInput } from "../../shared/errors.js";
import { queueAdminEmail, queueEmail } from "../email/outbox.service.js";
import { asLocale, siteUrl } from "../email/layout.js";
import {
  adminContactTemplate,
  contactReceivedTemplate,
  newsletterWelcomeTemplate,
} from "../email/templates/marketing.js";
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
  const before = await NewsletterSubscriberModel.findOne({ email: normalized }).select("status");
  await NewsletterSubscriberModel.updateOne(
    { email: normalized },
    { $set: { status: "subscribed", locale, source }, $setOnInsert: { email: normalized } },
    { upsert: true },
  );
  // Only a new (or returning) subscriber gets the welcome — re-submitting the form doesn't.
  if (before?.status !== "subscribed") {
    const L = asLocale(locale);
    await queueEmail({
      to: normalized,
      kind: "newsletter.welcome",
      ...newsletterWelcomeTemplate(L, unsubscribeUrl(normalized, L)),
    });
  }
  return { ok: true };
}

/** Signed so nobody can unsubscribe someone else by guessing their address. */
function unsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", env.JWT_ACCESS_SECRET).update(`unsubscribe:${email}`).digest("base64url").slice(0, 32);
}

export function unsubscribeUrl(email: string, locale: "en" | "hi"): string {
  return siteUrl(locale, `/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`);
}

/** The one-click link in newsletter emails. */
export async function unsubscribeNewsletter(email: string, token: string): Promise<{ ok: true }> {
  const normalized = email.toLowerCase().trim();
  const expected = unsubscribeToken(normalized);
  if (token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    throw badInput("This unsubscribe link isn't valid");
  }
  await NewsletterSubscriberModel.updateOne({ email: normalized }, { $set: { status: "unsubscribed" } });
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
  const c = {
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    phone: input.phone?.trim() ?? "",
    subject: input.subject?.trim() ?? "",
    message: input.message.trim(),
  };
  await queueEmail({ to: c.email, kind: "contact.received", ...contactReceivedTemplate({ ...c, locale: asLocale(input.locale) }) });
  await queueAdminEmail({ kind: "admin.contact", ...adminContactTemplate(c) });
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
