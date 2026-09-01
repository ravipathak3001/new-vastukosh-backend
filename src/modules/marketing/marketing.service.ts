import type { Locale } from "../../shared/localized.js";
import { NewsletterSubscriberModel, ContactSubmissionModel } from "./marketing.model.js";

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
