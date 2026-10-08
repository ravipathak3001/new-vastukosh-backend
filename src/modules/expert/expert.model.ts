import { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";
import { defineModel } from "../../shared/mongo.js";

/**
 * Marketplace of practitioners — pandits, astrologers, Vastu and gemstone
 * experts. An expert is a normal user account (role `expert`) plus an
 * `ExpertProfile`; customers book an expert's `ExpertOffering`, the platform
 * keeps a commission, and the expert's share lands in an append-only
 * `ExpertLedger` wallet they cash out from via `ExpertPayout`.
 */

export const EXPERT_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type ExpertStatus = (typeof EXPERT_STATUSES)[number];

export const EXPERT_SPECIALITIES = ["astro", "vastu", "gem", "pooja"] as const;
export type ExpertSpeciality = (typeof EXPERT_SPECIALITIES)[number];

const availabilityWindowSchema = new Schema(
  {
    /** 0 = Sunday … 6 = Saturday. */
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true }, // HH:mm (BOOKING_TIMEZONE)
    end: { type: String, required: true }, // HH:mm, exclusive
  },
  { _id: false },
);

const certificateSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    issuer: { type: String, default: "", trim: true },
    year: { type: Number, default: null },
    url: { type: String, default: "", trim: true },
  },
  { _id: false },
);

/** Payout destination + identity. Never exposed publicly. */
const kycSchema = new Schema(
  {
    legalName: { type: String, default: "", trim: true },
    panNumber: { type: String, default: "", trim: true, uppercase: true },
    idType: { type: String, enum: ["", "aadhaar", "voter_id", "passport", "driving_licence"], default: "" },
    /** Last 4 only for Aadhaar — we never store the full number. */
    idLast4: { type: String, default: "", trim: true },
    bankAccountName: { type: String, default: "", trim: true },
    bankAccountNumber: { type: String, default: "", trim: true },
    bankIfsc: { type: String, default: "", trim: true, uppercase: true },
    upiId: { type: String, default: "", trim: true, lowercase: true },
  },
  { _id: false },
);

const expertProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    /** Public URL handle: /experts/{slug}. */
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    /** e.g. "Pandit", "Acharya", "Jyotishacharya" — shown before the name. */
    title: { type: String, default: "", trim: true },
    photoUrl: { type: String, default: "", trim: true },
    headline: { type: String, default: "", trim: true, maxlength: 140 },
    bio: { type: String, default: "", trim: true, maxlength: 3000 },
    specialities: { type: [String], enum: EXPERT_SPECIALITIES, default: [] },
    languages: { type: [String], default: [] },
    experienceYears: { type: Number, min: 0, max: 80, default: 0 },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    certificates: { type: [certificateSchema], default: [] },
    kyc: { type: kycSchema, default: () => ({}) },

    status: { type: String, enum: EXPERT_STATUSES, default: "pending", index: true },
    statusNote: { type: String, default: "" },
    approvedAt: { type: Date, default: null },

    /** Weekly working hours. Empty = not taking bookings yet. */
    availability: { type: [availabilityWindowSchema], default: [] },
    /** yyyy-mm-dd dates the expert is away. */
    daysOff: { type: [String], default: [] },

    /** Overrides the marketplace default when set. */
    commissionPct: { type: Number, min: 0, max: 100, default: null },

    /** Cached wallet balance (₹) — the ledger is the source of truth; both change in one guarded write. */
    walletBalance: { type: Number, default: 0 },
    lifetimeEarnings: { type: Number, default: 0 },

    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
expertProfileSchema.index({ status: 1, specialities: 1 });

export type ExpertProfile = InferSchemaType<typeof expertProfileSchema>;
export type ExpertProfileDoc = HydratedDocument<ExpertProfile>;
export const ExpertProfileModel = defineModel("ExpertProfile", expertProfileSchema);

// ─── Offerings (what an expert sells, at their price) ────────────────────

export const OFFERING_KINDS = ["consultation", "pooja"] as const;

const expertOfferingSchema = new Schema(
  {
    expertId: { type: Schema.Types.ObjectId, ref: "ExpertProfile", required: true, index: true },
    kind: { type: String, enum: OFFERING_KINDS, required: true },
    /** `astro` / `vastu` / `gem` for consultations; a pooja slug for poojas. */
    serviceKey: { type: String, required: true, lowercase: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    durationMins: { type: Number, required: true, min: 5 },
    /** Pooja only: how many pandits perform it. */
    panditCount: { type: Number, min: 1, max: 51, default: 1 },
    /** Pooja only: whether samagri (ritual materials) is included in the price. */
    samagriIncluded: { type: Boolean, default: true },
    /** Free text shown to customers, e.g. "Includes Rudri path ×11". */
    notes: { type: String, default: "", trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
expertOfferingSchema.index({ expertId: 1, kind: 1, serviceKey: 1 }, { unique: true });
expertOfferingSchema.index({ kind: 1, serviceKey: 1, active: 1 });

export type ExpertOffering = InferSchemaType<typeof expertOfferingSchema>;
export type ExpertOfferingDoc = HydratedDocument<ExpertOffering>;
export const ExpertOfferingModel = defineModel("ExpertOffering", expertOfferingSchema);

// ─── Wallet ledger ────────────────────────────────────────────────────────

export const LEDGER_TYPES = [
  "booking_credit", // expert's share of a completed booking
  "booking_reversal", // a completed booking was refunded afterwards
  "payout_hold", // cashout requested — funds held
  "payout_release", // cashout rejected — funds returned
  "adjustment", // manual admin correction
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

const expertLedgerSchema = new Schema(
  {
    expertId: { type: Schema.Types.ObjectId, ref: "ExpertProfile", required: true, index: true },
    type: { type: String, enum: LEDGER_TYPES, required: true },
    /** Signed rupees: + credits the wallet, − debits it. */
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "ConsultationBooking", default: null },
    payoutId: { type: Schema.Types.ObjectId, ref: "ExpertPayout", default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);
// One credit and at most one reversal per booking; one hold/release per payout — makes retries idempotent.
expertLedgerSchema.index(
  { bookingId: 1, type: 1 },
  { unique: true, partialFilterExpression: { bookingId: { $type: "objectId" } } },
);
expertLedgerSchema.index(
  { payoutId: 1, type: 1 },
  { unique: true, partialFilterExpression: { payoutId: { $type: "objectId" } } },
);

export type ExpertLedgerEntry = InferSchemaType<typeof expertLedgerSchema>;
export type ExpertLedgerDoc = HydratedDocument<ExpertLedgerEntry>;
export const ExpertLedgerModel = defineModel("ExpertLedger", expertLedgerSchema);

// ─── Payouts (cashouts) ───────────────────────────────────────────────────

export const PAYOUT_STATUSES = ["requested", "paid", "rejected"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

const expertPayoutSchema = new Schema(
  {
    payoutNo: { type: String, required: true, unique: true },
    expertId: { type: Schema.Types.ObjectId, ref: "ExpertProfile", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    status: { type: String, enum: PAYOUT_STATUSES, default: "requested", index: true },
    /** Snapshot of where to send it, taken at request time. */
    method: { type: String, enum: ["bank", "upi"], required: true },
    destination: { type: String, required: true },
    /** Bank UTR / UPI reference entered by admin when paid. */
    reference: { type: String, default: "" },
    adminNote: { type: String, default: "" },
    processedAt: { type: Date, default: null },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export type ExpertPayout = InferSchemaType<typeof expertPayoutSchema>;
export type ExpertPayoutDoc = HydratedDocument<ExpertPayout>;
export const ExpertPayoutModel = defineModel("ExpertPayout", expertPayoutSchema);

// ─── Reviews ──────────────────────────────────────────────────────────────

const expertReviewSchema = new Schema(
  {
    expertId: { type: Schema.Types.ObjectId, ref: "ExpertProfile", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "ConsultationBooking", required: true, unique: true },
    authorName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 1000 },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type ExpertReview = InferSchemaType<typeof expertReviewSchema>;
export type ExpertReviewDoc = HydratedDocument<ExpertReview>;
export const ExpertReviewModel = defineModel("ExpertReview", expertReviewSchema);

// ─── Marketplace settings (singleton) ─────────────────────────────────────

const marketplaceSettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    /** Platform's cut of each expert booking, in %. */
    commissionPct: { type: Number, min: 0, max: 100, default: 20 },
    /** Smallest cashout an expert may request, ₹. */
    minPayout: { type: Number, min: 0, default: 500 },
  },
  { timestamps: true },
);

export type MarketplaceSettings = InferSchemaType<typeof marketplaceSettingsSchema>;
export const MarketplaceSettingsModel = defineModel("MarketplaceSettings", marketplaceSettingsSchema);
