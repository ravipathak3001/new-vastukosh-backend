import { Schema, type HydratedDocument, type InferSchemaType } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

export const OUTBOX_STATUSES = ["queued", "sent", "failed"] as const;

/**
 * Every email goes through here before it is handed to the provider, so a
 * mail-server hiccup is retried instead of lost, and a webhook that fires
 * twice can't send the same message twice (`dedupeKey`).
 */
const emailOutboxSchema = new Schema(
  {
    to: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, default: "" },
    /** What it's about, e.g. `order.confirmed` — for the log and debugging. */
    kind: { type: String, required: true, index: true },
    /** Order/booking/return number etc. the email belongs to. */
    ref: { type: String, default: "", index: true },
    /** Same key twice = same email; the second is dropped. */
    dedupeKey: { type: String, index: { unique: true, sparse: true } },
    status: { type: String, enum: OUTBOX_STATUSES, default: "queued", index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date(), index: true },
    lastError: { type: String, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type EmailOutbox = InferSchemaType<typeof emailOutboxSchema>;
export type EmailOutboxDoc = HydratedDocument<EmailOutbox>;
export const EmailOutboxModel = defineModel("EmailOutbox", emailOutboxSchema);
