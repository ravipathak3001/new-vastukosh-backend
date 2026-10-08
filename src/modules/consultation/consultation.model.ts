import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";
import { localizedSchema } from "../../shared/localized.js";

export const CONSULTATION_SERVICE_KEYS = ["astro", "vastu", "gem"] as const;
export type ConsultationServiceKey = (typeof CONSULTATION_SERVICE_KEYS)[number];

const consultationServiceSchema = new Schema(
  {
    key: { type: String, enum: CONSULTATION_SERVICE_KEYS, required: true, unique: true },
    name: { type: localizedSchema, required: true },
    meta: { type: localizedSchema, required: true },
    durationMins: { type: Number, required: true },
    price: { type: Number, required: true },
    icon: { type: String, default: "stars" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
export type ConsultationService = InferSchemaType<typeof consultationServiceSchema>;
export type ConsultationServiceDoc = HydratedDocument<ConsultationService>;
export const ConsultationServiceModel = defineModel("ConsultationService", consultationServiceSchema);

// ─── Online pooja catalog ─────────────────────────────────────────────────

/**
 * Poojas performed by the pandit on the devotee's behalf (sankalp in their
 * name); the recording is shared once complete. Admin-managed, so unlike
 * consultation services the slugs are free-form rather than a fixed enum.
 */
const poojaServiceSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: localizedSchema, required: true },
    description: { type: localizedSchema, required: true },
    durationMins: { type: Number, required: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
    icon: { type: String, default: "temple_hindu" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
export type PoojaService = InferSchemaType<typeof poojaServiceSchema>;
export type PoojaServiceDoc = HydratedDocument<PoojaService>;
export const PoojaServiceModel = defineModel("PoojaService", poojaServiceSchema);

// ─── Bookings ─────────────────────────────────────────────────────────────

export const BOOKING_KINDS = ["consultation", "pooja"] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];

/**
 * - `pending_payment`  created, slot held until `holdExpiresAt` while the customer pays
 * - `requested`        paid (or free) — awaiting admin confirmation
 * - `reschedule_proposed` admin can't do the slot and offered `proposedDate/Slot`
 * - `confirmed`        accepted; consultations carry a meeting link
 * - `completed`        done; poojas carry a recording link
 * - `cancelled`        unpaid hold expired, or cancelled before any capture
 * - `refunded`         payment returned (e.g. reschedule declined)
 */
export const BOOKING_STATUSES = [
  "pending_payment",
  "requested",
  "reschedule_proposed",
  "confirmed",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_PAYMENT_STATUSES = ["none", "created", "captured", "failed"] as const;

const bookingPaymentSchema = new Schema(
  {
    provider: { type: String, default: "" },
    /** Gateway order id (Razorpay `order_...`). */
    providerRef: { type: String, default: "", index: true },
    /** Gateway payment id (Razorpay `pay_...`), set once captured. */
    transactionId: { type: String, default: "" },
    status: { type: String, enum: BOOKING_PAYMENT_STATUSES, default: "none" },
    refundId: { type: String, default: "" },
    refundStatus: { type: String, enum: ["", "pending", "processed", "failed"], default: "" },
    refundAmount: { type: Number, default: 0 },
  },
  { _id: false },
);

const bookingMeetingSchema = new Schema(
  {
    provider: { type: String, required: true },
    url: { type: String, required: true },
    eventId: { type: String, default: "" },
  },
  { _id: false },
);

const bookingHistorySchema = new Schema(
  {
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    at: { type: Date, required: true, default: () => new Date() },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const bookingSchema = new Schema(
  {
    /** Human-readable reference (`VB-4821-Om`). Absent on bookings made before payments existed. */
    bookingNo: { type: String, unique: true, sparse: true },
    kind: { type: String, enum: BOOKING_KINDS, default: "consultation", index: true },
    /** Consultation service key (`astro`…) or pooja slug, depending on `kind`. */
    serviceKey: { type: String, required: true },
    /** Service name at booking time, so renames don't rewrite history. */
    serviceName: { type: localizedSchema, default: null },
    durationMins: { type: Number, default: 0 },
    date: { type: String, required: true }, // ISO yyyy-mm-dd
    slot: { type: String, required: true }, // HH:mm
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    birthDetails: {
      date: { type: String, default: "" },
      time: { type: String, default: "" },
      place: { type: String, default: "" },
    },
    /** Pooja only — the details the pandit recites in the sankalp. */
    sankalp: {
      gotra: { type: String, default: "" },
      nakshatra: { type: String, default: "" },
      rashi: { type: String, default: "" },
      familyMembers: { type: [String], default: [] },
      purpose: { type: String, default: "" },
    },
    notes: { type: String, default: "" },
    locale: { type: String, enum: ["en", "hi"], default: "en" },
    status: { type: String, enum: BOOKING_STATUSES, default: "requested", index: true },
    holdExpiresAt: { type: Date, default: null },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    payment: { type: bookingPaymentSchema, default: () => ({}) },
    /** Checkout payload (public gateway ids only) so an abandoned payment can be resumed. */
    paymentClientData: { type: Schema.Types.Mixed, default: null },
    meeting: { type: bookingMeetingSchema, default: null },
    recordingUrl: { type: String, default: "" },
    proposedDate: { type: String, default: "" },
    proposedSlot: { type: String, default: "" },
    adminNote: { type: String, default: "" },
    history: { type: [bookingHistorySchema], default: [] },
    /** Lets guests manage their booking from the emailed link without an account. */
    accessToken: { type: String, default: "" },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    /**
     * Marketplace: the expert performing this booking. `null` = a platform
     * booking (priced from the catalog) that an admin may assign later.
     */
    expertId: { type: Schema.Types.ObjectId, ref: "ExpertProfile", default: null, index: true },
    offeringId: { type: Schema.Types.ObjectId, ref: "ExpertOffering", default: null },
    /** Pooja: pandits performing it, as offered at booking time. */
    panditCount: { type: Number, default: 1 },
    samagriIncluded: { type: Boolean, default: false },
    /** Split fixed when the expert is attached, so later commission changes don't rewrite history. */
    commissionPct: { type: Number, default: null },
    platformFee: { type: Number, default: 0 },
    expertEarning: { type: Number, default: 0 },
    /** Set once the customer has reviewed the expert for this booking. */
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
bookingSchema.index({ kind: 1, date: 1, slot: 1 });
bookingSchema.index({ expertId: 1, date: 1 });
bookingSchema.index({ kind: 1, proposedDate: 1 });

export type ConsultationBooking = InferSchemaType<typeof bookingSchema>;
export type ConsultationBookingDoc = HydratedDocument<ConsultationBooking>;
export const ConsultationBookingModel = defineModel("ConsultationBooking", bookingSchema);
