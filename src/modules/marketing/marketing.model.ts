import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

const newsletterSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    locale: { type: String, enum: ["en", "hi"], default: "en" },
    status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed", index: true },
    source: { type: String, default: "footer" },
  },
  { timestamps: true },
);
export type NewsletterSubscriber = InferSchemaType<typeof newsletterSchema>;
export type NewsletterSubscriberDoc = HydratedDocument<NewsletterSubscriber>;
export const NewsletterSubscriberModel = defineModel("NewsletterSubscriber", newsletterSchema);

const contactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    subject: { type: String, default: "" },
    message: { type: String, required: true },
    status: { type: String, enum: ["new", "read", "responded"], default: "new", index: true },
    locale: { type: String, enum: ["en", "hi"], default: "en" },
  },
  { timestamps: true },
);
export type ContactSubmission = InferSchemaType<typeof contactSchema>;
export type ContactSubmissionDoc = HydratedDocument<ContactSubmission>;
export const ContactSubmissionModel = defineModel("ContactSubmission", contactSchema);
