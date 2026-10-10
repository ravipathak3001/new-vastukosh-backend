import { Types, type FilterQuery } from "mongoose";
import { customAlphabet } from "nanoid";
import { logger } from "../../config/logger.js";
import { badInput, conflict, forbidden, notFound } from "../../shared/errors.js";
import { searchRegex } from "../../graphql/admin-common.js";
import { notifyFrontendRevalidate } from "../../shared/http/revalidate-client.js";
import { UserModel } from "../auth/auth.model.js";
import {
  CONSULTATION_SERVICE_KEYS,
  ConsultationBookingModel,
  ConsultationServiceModel,
  PoojaServiceModel,
  type ConsultationBookingDoc,
} from "../consultation/consultation.model.js";
import {
  HHMM,
  ISO_DATE,
  daysBetween,
  minutesToSlot,
  nowInZone,
  slotMinutes,
  weekdayOf,
} from "../consultation/booking-time.js";
import {
  EXPERT_SPECIALITIES,
  ExpertLedgerModel,
  ExpertOfferingModel,
  ExpertPayoutModel,
  ExpertProfileModel,
  ExpertReviewModel,
  MarketplaceSettingsModel,
  type ExpertOfferingDoc,
  type ExpertPayoutDoc,
  type ExpertProfile,
  type ExpertProfileDoc,
  type ExpertSpeciality,
  type ExpertStatus,
  type LedgerType,
} from "./expert.model.js";

/**
 * The website caches the expert directory and profiles (tag `experts`); tell it
 * to refresh after anything a customer would see changes. Fire and forget.
 */
function refreshPublicExperts() {
  void notifyFrontendRevalidate(["experts"]);
}

const SLOT_STEP_MINS = 30;
const SAME_DAY_LEAD_MINS = 60;
const MAX_DAYS_AHEAD = 120;

/** Statuses during which a booking occupies the expert's calendar. */
const BUSY_STATUSES = ["requested", "confirmed", "reschedule_proposed"] as const;

// ─── Settings ─────────────────────────────────────────────────────────────

export async function getMarketplaceSettings() {
  return MarketplaceSettingsModel.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function updateMarketplaceSettings(input: {
  commissionPct?: number | null;
  minPayout?: number | null;
}) {
  const set: Record<string, number> = {};
  if (input.commissionPct != null) {
    if (input.commissionPct < 0 || input.commissionPct > 100) throw badInput("Commission must be 0–100%");
    set.commissionPct = input.commissionPct;
  }
  if (input.minPayout != null) {
    if (input.minPayout < 0) throw badInput("Minimum cashout can't be negative");
    set.minPayout = input.minPayout;
  }
  return MarketplaceSettingsModel.findOneAndUpdate(
    { key: "default" },
    { $set: set },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

/** Platform / expert split for a booking amount, rounded to whole rupees. */
export async function computeSplit(amount: number, expert: Pick<ExpertProfile, "commissionPct">) {
  const pct = expert.commissionPct ?? (await getMarketplaceSettings()).commissionPct;
  const platformFee = Math.round((amount * pct) / 100);
  return { commissionPct: pct, platformFee, expertEarning: Math.max(0, amount - platformFee) };
}

// ─── Profile ──────────────────────────────────────────────────────────────

const slugSuffix = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 4);

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "expert"
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  if (!(await ExpertProfileModel.exists({ slug: base }))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${slugSuffix()}`;
    if (!(await ExpertProfileModel.exists({ slug: candidate }))) return candidate;
  }
  throw conflict("Couldn't generate a profile link — try a different name");
}

export type ExpertProfileInput = {
  displayName?: string;
  title?: string;
  photoUrl?: string;
  headline?: string;
  bio?: string;
  specialities?: string[];
  languages?: string[];
  experienceYears?: number;
  city?: string;
  state?: string;
  phone?: string;
  certificates?: { title: string; issuer?: string; year?: number | null; url?: string }[];
};

function cleanProfileInput(input: ExpertProfileInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const str = (k: keyof ExpertProfileInput, max = 200) => {
    const v = input[k];
    if (typeof v === "string") out[k] = v.trim().slice(0, max);
  };
  str("displayName", 80);
  str("title", 40);
  str("headline", 140);
  str("bio", 3000);
  str("city", 60);
  str("state", 60);
  str("phone", 20);
  if (typeof input.photoUrl === "string") {
    const url = input.photoUrl.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url) && !url.startsWith("/")) {
      throw badInput("Photo must be a link (https://…)");
    }
    out.photoUrl = url;
  }
  if (input.specialities) {
    const bad = input.specialities.filter((s) => !(EXPERT_SPECIALITIES as readonly string[]).includes(s));
    if (bad.length) throw badInput(`Unknown speciality: ${bad.join(", ")}`);
    out.specialities = [...new Set(input.specialities)];
  }
  if (input.languages) {
    out.languages = [...new Set(input.languages.map((l) => l.trim()).filter(Boolean))].slice(0, 12);
  }
  if (input.experienceYears != null) {
    if (!Number.isInteger(input.experienceYears) || input.experienceYears < 0 || input.experienceYears > 80) {
      throw badInput("Experience must be a whole number of years");
    }
    out.experienceYears = input.experienceYears;
  }
  if (input.certificates) {
    out.certificates = input.certificates
      .filter((c) => c.title?.trim())
      .slice(0, 20)
      .map((c) => ({
        title: c.title.trim(),
        issuer: c.issuer?.trim() ?? "",
        year: c.year ?? null,
        url: c.url?.trim() ?? "",
      }));
  }
  return out;
}

/**
 * A signed-in user applies to join as an expert. Creates a `pending` profile
 * (they can set up services, prices and hours right away) and grants the
 * `expert` role — picked up on their next token refresh.
 */
export async function applyAsExpert(userId: string, input: ExpertProfileInput) {
  if (await ExpertProfileModel.exists({ userId })) throw conflict("You've already applied");
  const user = await UserModel.findById(userId);
  if (!user) throw notFound("User");
  const fields = cleanProfileInput(input);
  const displayName = (fields.displayName as string | undefined) || user.name;
  if (!fields.specialities || (fields.specialities as string[]).length === 0) {
    throw badInput("Choose at least one speciality");
  }
  const profile = await ExpertProfileModel.create({
    ...fields,
    displayName,
    phone: (fields.phone as string | undefined) || user.phone,
    userId,
    slug: await uniqueSlug(displayName),
    status: "pending",
  });
  if (!user.roles.includes("expert")) {
    user.roles.push("expert");
    await user.save();
  }
  logger.info({ expertId: String(profile._id) }, "New expert application");
  return profile;
}

export async function getMyExpertProfile(userId: string): Promise<ExpertProfileDoc> {
  const p = await ExpertProfileModel.findOne({ userId });
  if (!p) throw notFound("Expert profile");
  return p;
}

/** Resolves the caller's expert id, or null — used for "is this the booking's expert?" checks. */
export async function expertIdForUser(userId: string | undefined | null): Promise<string | null> {
  if (!userId) return null;
  const p = await ExpertProfileModel.findOne({ userId }).select("_id");
  return p ? String(p._id) : null;
}

export async function updateMyExpertProfile(userId: string, input: ExpertProfileInput) {
  const p = await getMyExpertProfile(userId);
  const fields = cleanProfileInput(input);
  if (fields.specialities && (fields.specialities as string[]).length === 0) {
    throw badInput("Choose at least one speciality");
  }
  Object.assign(p, fields);
  // A rejected expert who edits their profile is re-submitted for review.
  if (p.status === "rejected") {
    p.status = "pending";
    p.statusNote = "";
  }
  await p.save();
  refreshPublicExperts();
  return p;
}

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const UPI = /^[\w.-]{2,}@[a-z]{2,}$/i;

export type ExpertKycInput = {
  legalName?: string;
  panNumber?: string;
  idType?: string;
  idLast4?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  upiId?: string;
};

export async function updateMyExpertKyc(userId: string, input: ExpertKycInput) {
  const p = await getMyExpertProfile(userId);
  const k = { ...(p.kyc ?? {}) } as Record<string, string>;
  const take = (key: keyof ExpertKycInput) => {
    const v = input[key];
    if (typeof v === "string") k[key] = v.trim();
  };
  (Object.keys(input) as (keyof ExpertKycInput)[]).forEach(take);
  if (k.panNumber) k.panNumber = k.panNumber.toUpperCase();
  if (k.bankIfsc) k.bankIfsc = k.bankIfsc.toUpperCase();
  if (k.panNumber && !PAN.test(k.panNumber)) throw badInput("PAN should look like ABCDE1234F");
  if (k.bankIfsc && !IFSC.test(k.bankIfsc)) throw badInput("IFSC should look like SBIN0001234");
  if (k.bankAccountNumber && !/^\d{9,18}$/.test(k.bankAccountNumber)) {
    throw badInput("Account number should be 9–18 digits");
  }
  if (k.upiId && !UPI.test(k.upiId)) throw badInput("UPI ID should look like name@bank");
  if (k.idLast4 && !/^\d{4}$/.test(k.idLast4)) throw badInput("Enter only the last 4 digits of your ID");
  p.set("kyc", k);
  await p.save();
  return p;
}

export async function setMyAvailability(
  userId: string,
  windows: { day: number; start: string; end: string }[],
  daysOff: string[],
) {
  const p = await getMyExpertProfile(userId);
  for (const w of windows) {
    if (!Number.isInteger(w.day) || w.day < 0 || w.day > 6) throw badInput("Day must be 0 (Sun) – 6 (Sat)");
    if (!HHMM.test(w.start) || !HHMM.test(w.end)) throw badInput("Times must be HH:mm");
    if (slotMinutes(w.end) <= slotMinutes(w.start)) throw badInput("Each window must end after it starts");
  }
  // No overlapping windows on the same day.
  for (let d = 0; d < 7; d++) {
    const day = windows
      .filter((w) => w.day === d)
      .sort((a, b) => slotMinutes(a.start) - slotMinutes(b.start));
    for (let i = 1; i < day.length; i++) {
      if (slotMinutes(day[i]!.start) < slotMinutes(day[i - 1]!.end)) {
        throw badInput("Working hours overlap on the same day");
      }
    }
  }
  const off = [...new Set(daysOff)].filter((d) => ISO_DATE.test(d)).sort();
  p.set("availability", windows);
  p.set("daysOff", off);
  await p.save();
  refreshPublicExperts();
  return p;
}

// ─── Offerings ────────────────────────────────────────────────────────────

export type OfferingInput = {
  kind: "consultation" | "pooja";
  serviceKey: string;
  price: number;
  durationMins: number;
  panditCount?: number | null;
  samagriIncluded?: boolean | null;
  notes?: string | null;
  active?: boolean | null;
};

async function assertServiceExists(kind: string, serviceKey: string) {
  if (kind === "pooja") {
    if (!(await PoojaServiceModel.exists({ slug: serviceKey, active: true }))) {
      throw badInput("That pooja isn't in the catalog");
    }
  } else if (
    !(CONSULTATION_SERVICE_KEYS as readonly string[]).includes(serviceKey) ||
    !(await ConsultationServiceModel.exists({ key: serviceKey, active: true }))
  ) {
    throw badInput("Unknown consultation type");
  }
}

/** Keeps `specialities` in step with what the expert actually offers. */
async function syncSpecialities(expertId: Types.ObjectId | string) {
  const offerings = await ExpertOfferingModel.find({ expertId, active: true }).select("kind serviceKey");
  const derived = new Set<ExpertSpeciality>();
  for (const o of offerings) derived.add(o.kind === "pooja" ? "pooja" : (o.serviceKey as ExpertSpeciality));
  if (derived.size) {
    await ExpertProfileModel.updateOne({ _id: expertId }, { $addToSet: { specialities: { $each: [...derived] } } });
  }
}

export async function upsertMyOffering(userId: string, input: OfferingInput) {
  const p = await getMyExpertProfile(userId);
  const serviceKey = input.serviceKey.trim().toLowerCase();
  await assertServiceExists(input.kind, serviceKey);
  if (!Number.isFinite(input.price) || input.price < 0) throw badInput("Price must be zero or more");
  if (!Number.isInteger(input.durationMins) || input.durationMins < 15 || input.durationMins > 600) {
    throw badInput("Duration must be 15–600 minutes");
  }
  if (input.durationMins % 15 !== 0) throw badInput("Duration must be in 15-minute steps");
  const panditCount = input.kind === "pooja" ? input.panditCount ?? 1 : 1;
  if (!Number.isInteger(panditCount) || panditCount < 1 || panditCount > 51) {
    throw badInput("Number of pandits must be 1–51");
  }
  const doc = await ExpertOfferingModel.findOneAndUpdate(
    { expertId: p._id, kind: input.kind, serviceKey },
    {
      $set: {
        price: Math.round(input.price),
        durationMins: input.durationMins,
        panditCount,
        samagriIncluded: input.kind === "pooja" ? input.samagriIncluded ?? true : false,
        notes: input.notes?.trim().slice(0, 500) ?? "",
        active: input.active ?? true,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await syncSpecialities(p._id);
  refreshPublicExperts();
  return doc;
}

export async function deleteMyOffering(userId: string, offeringId: string) {
  const p = await getMyExpertProfile(userId);
  const res = await ExpertOfferingModel.deleteOne({ _id: offeringId, expertId: p._id });
  if (res.deletedCount === 0) throw notFound("Offering");
  refreshPublicExperts();
  return true;
}

export async function listOfferings(expertId: Types.ObjectId | string, activeOnly = false) {
  return ExpertOfferingModel.find({ expertId, ...(activeOnly ? { active: true } : {}) }).sort({
    kind: 1,
    serviceKey: 1,
  });
}

// ─── Public directory ─────────────────────────────────────────────────────

export type ExpertListFilter = {
  speciality?: ExpertSpeciality | null;
  /** Only experts offering this service (consultation key or pooja slug). */
  serviceKey?: string | null;
  language?: string | null;
  search?: string | null;
  sort?: "rating" | "price_low" | "price_high" | "experience" | null;
};

export async function listExperts(filter: ExpertListFilter, limit = 24, offset = 0) {
  const q: FilterQuery<ExpertProfile> = { status: "approved" };
  if (filter.speciality) q.specialities = filter.speciality;
  if (filter.language) q.languages = new RegExp(`^${filter.language.trim()}$`, "i");
  if (filter.search?.trim()) {
    const rx = searchRegex(filter.search);
    q.$or = [{ displayName: rx }, { headline: rx }, { city: rx }];
  }

  // Price-aware filtering/sorting goes through offerings.
  let priceByExpert: Map<string, number> | null = null;
  if (filter.serviceKey || filter.sort === "price_low" || filter.sort === "price_high") {
    const oq: FilterQuery<ExpertOfferingDoc> = { active: true };
    if (filter.serviceKey) oq.serviceKey = filter.serviceKey.toLowerCase();
    else if (filter.speciality) {
      if (filter.speciality === "pooja") oq.kind = "pooja";
      else oq.serviceKey = filter.speciality;
    }
    const offerings = await ExpertOfferingModel.find(oq).select("expertId price");
    priceByExpert = new Map();
    for (const o of offerings) {
      const k = String(o.expertId);
      priceByExpert.set(k, Math.min(priceByExpert.get(k) ?? Infinity, o.price));
    }
    q._id = { $in: [...priceByExpert.keys()] };
  }

  const all = await ExpertProfileModel.find(q);
  const sorted = all.sort((a, b) => {
    switch (filter.sort) {
      case "price_low":
        return (priceByExpert!.get(String(a._id)) ?? 0) - (priceByExpert!.get(String(b._id)) ?? 0);
      case "price_high":
        return (priceByExpert!.get(String(b._id)) ?? 0) - (priceByExpert!.get(String(a._id)) ?? 0);
      case "experience":
        return b.experienceYears - a.experienceYears;
      default:
        // Rating, weighted so a single 5★ doesn't outrank a 4.8★ from 200 reviews.
        return b.ratingAvg * Math.min(b.ratingCount, 20) - a.ratingAvg * Math.min(a.ratingCount, 20) ||
          b.completedCount - a.completedCount;
    }
  });
  return { items: sorted.slice(offset, offset + limit), total: sorted.length };
}

export async function getExpertBySlug(slug: string, opts: { includeUnapproved?: boolean } = {}) {
  const p = await ExpertProfileModel.findOne({ slug: slug.toLowerCase() });
  if (!p || (p.status !== "approved" && !opts.includeUnapproved)) return null;
  return p;
}

export async function getActiveOffering(expertId: Types.ObjectId | string, kind: string, serviceKey: string) {
  return ExpertOfferingModel.findOne({ expertId, kind, serviceKey: serviceKey.toLowerCase(), active: true });
}

// ─── Availability → slots ─────────────────────────────────────────────────

type Interval = { start: number; end: number };

/** The expert's busy intervals (minutes since midnight) on `date`. */
async function busyIntervals(expertId: Types.ObjectId | string, date: string, excludeBookingId?: string) {
  const bookings = await ConsultationBookingModel.find({
    expertId,
    ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
    $or: [
      { date, status: { $in: ["requested", "confirmed"] } },
      { date, status: "pending_payment", holdExpiresAt: { $gt: new Date() } },
      { proposedDate: date, status: "reschedule_proposed" },
    ],
  }).select("date slot durationMins status proposedDate proposedSlot");
  return bookings.map((b): Interval => {
    const slot = b.status === "reschedule_proposed" ? b.proposedSlot : b.slot;
    const start = slotMinutes(slot);
    return { start, end: start + (b.durationMins || 60) };
  });
}

/**
 * Start times on `date` when this expert can fit a `durationMins` session:
 * inside a working window, not on a day off, not overlapping another booking,
 * on a 30-minute grid, with same-day lead time.
 */
export async function expertAvailableSlots(
  expert: Pick<ExpertProfileDoc, "_id" | "availability" | "daysOff" | "status">,
  date: string,
  durationMins: number,
  excludeBookingId?: string,
): Promise<string[]> {
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw badInput("date must be yyyy-mm-dd");
  }
  if (expert.status !== "approved") return [];
  const now = nowInZone();
  const ahead = daysBetween(now.date, date);
  if (ahead < 0 || ahead > MAX_DAYS_AHEAD) return [];
  if ((expert.daysOff ?? []).includes(date)) return [];

  const day = weekdayOf(date);
  const windows = (expert.availability ?? []).filter((w) => w.day === day);
  if (!windows.length) return [];
  const busy = await busyIntervals(expert._id, date, excludeBookingId);

  const out: string[] = [];
  for (const w of windows) {
    const wStart = slotMinutes(w.start);
    const wEnd = slotMinutes(w.end);
    const first = Math.ceil(wStart / SLOT_STEP_MINS) * SLOT_STEP_MINS;
    for (let t = first; t + durationMins <= wEnd; t += SLOT_STEP_MINS) {
      if (ahead === 0 && t < now.minutes + SAME_DAY_LEAD_MINS) continue;
      if (busy.some((b) => t < b.end && t + durationMins > b.start)) continue;
      out.push(minutesToSlot(t));
    }
  }
  return [...new Set(out)].sort();
}

/** True when the expert has another active booking overlapping this one (used to settle simultaneous bookings). */
export async function expertHasClash(booking: ConsultationBookingDoc): Promise<boolean> {
  if (!booking.expertId) return false;
  const start = slotMinutes(booking.slot);
  const end = start + (booking.durationMins || 60);
  const others = await ConsultationBookingModel.find({
    _id: { $lt: booking._id },
    expertId: booking.expertId,
    date: booking.date,
    $or: [
      { status: { $in: [...BUSY_STATUSES] } },
      { status: "pending_payment", holdExpiresAt: { $gt: new Date() } },
    ],
  }).select("slot durationMins");
  return others.some((o) => {
    const s = slotMinutes(o.slot);
    return start < s + (o.durationMins || 60) && end > s;
  });
}

// ─── Wallet ───────────────────────────────────────────────────────────────

function isDupKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Appends a ledger entry and moves the cached balance by the same amount.
 * The ledger insert goes first: its unique (bookingId|payoutId, type) index is
 * what makes credits/reversals idempotent — a retry hits the duplicate key and
 * changes nothing. With `requireFunds`, the balance move is guarded so a debit
 * can never take the wallet below zero (the entry is withdrawn if it would).
 */
async function postLedger(entry: {
  expertId: Types.ObjectId | string;
  type: LedgerType;
  amount: number;
  bookingId?: Types.ObjectId | string | null;
  payoutId?: Types.ObjectId | string | null;
  note?: string;
  /** Lifetime earnings move with credits/reversals only. */
  countsAsEarning?: boolean;
  requireFunds?: boolean;
}): Promise<"posted" | "duplicate" | "insufficient"> {
  let ledger;
  try {
    ledger = await ExpertLedgerModel.create({
      expertId: entry.expertId,
      type: entry.type,
      amount: entry.amount,
      balanceAfter: 0,
      bookingId: entry.bookingId ?? null,
      payoutId: entry.payoutId ?? null,
      note: entry.note ?? "",
    });
  } catch (err) {
    if (isDupKey(err)) return "duplicate";
    throw err;
  }
  const guard =
    entry.requireFunds && entry.amount < 0 ? { walletBalance: { $gte: -entry.amount } } : {};
  const profile = await ExpertProfileModel.findOneAndUpdate(
    { _id: entry.expertId, ...guard },
    {
      $inc: {
        walletBalance: entry.amount,
        ...(entry.countsAsEarning ? { lifetimeEarnings: entry.amount } : {}),
      },
    },
    { new: true },
  );
  if (!profile) {
    await ExpertLedgerModel.deleteOne({ _id: ledger._id });
    return "insufficient";
  }
  ledger.balanceAfter = profile.walletBalance;
  await ledger.save();
  return "posted";
}

/** Credits the expert's share once a booking is completed. Idempotent. */
export async function creditBookingEarning(booking: ConsultationBookingDoc): Promise<void> {
  if (!booking.expertId || !(booking.expertEarning > 0)) return;
  const credited = (await postLedger({
    expertId: booking.expertId,
    type: "booking_credit",
    amount: booking.expertEarning,
    bookingId: booking._id,
    note: `Booking ${booking.bookingNo ?? ""}`.trim(),
    countsAsEarning: true,
  })) === "posted";
  if (credited) {
    await ExpertProfileModel.updateOne({ _id: booking.expertId }, { $inc: { completedCount: 1 } });
  }
}

/** Takes back an already-credited share when a completed booking is refunded. Idempotent. */
export async function reverseBookingEarning(booking: ConsultationBookingDoc): Promise<void> {
  if (!booking.expertId) return;
  const credit = await ExpertLedgerModel.findOne({ bookingId: booking._id, type: "booking_credit" });
  if (!credit) return;
  const reversed = (await postLedger({
    expertId: booking.expertId,
    type: "booking_reversal",
    amount: -credit.amount,
    bookingId: booking._id,
    note: `Refund of booking ${booking.bookingNo ?? ""}`.trim(),
    countsAsEarning: true,
  })) === "posted";
  if (reversed) {
    await ExpertProfileModel.updateOne({ _id: booking.expertId }, { $inc: { completedCount: -1 } });
  }
}

export async function adjustExpertWallet(expertId: string, amount: number, note: string) {
  if (!Number.isFinite(amount) || amount === 0) throw badInput("Enter a non-zero amount");
  if (!note.trim()) throw badInput("Add a note explaining the adjustment");
  if (!(await ExpertProfileModel.exists({ _id: expertId }))) throw notFound("Expert");
  await postLedger({ expertId, type: "adjustment", amount: Math.round(amount), note: note.trim() });
  return (await ExpertProfileModel.findById(expertId))!;
}

export async function listLedger(expertId: Types.ObjectId | string, limit = 100) {
  return ExpertLedgerModel.find({ expertId }).sort({ _id: -1 }).limit(limit);
}

// ─── Payouts ──────────────────────────────────────────────────────────────

const payoutCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

function payoutDestination(p: ExpertProfileDoc): { method: "bank" | "upi"; destination: string } | null {
  const k = p.kyc;
  if (k?.bankAccountNumber && k.bankIfsc) {
    return {
      method: "bank",
      destination: `${k.bankAccountName || k.legalName || p.displayName} · A/c ${k.bankAccountNumber} · ${k.bankIfsc}`,
    };
  }
  if (k?.upiId) return { method: "upi", destination: k.upiId };
  return null;
}

/**
 * Expert asks to withdraw `amount`. The funds are held immediately (balance
 * drops) so the same money can't be requested twice; a rejected request
 * releases them back.
 */
export async function requestPayout(userId: string, amount: number): Promise<ExpertPayoutDoc> {
  const p = await getMyExpertProfile(userId);
  if (p.status !== "approved") throw forbidden("Cashouts open once your profile is approved");
  const settings = await getMarketplaceSettings();
  const rupees = Math.floor(amount);
  if (!(rupees >= settings.minPayout) || rupees < 1) {
    throw badInput(`Minimum cashout is ₹${settings.minPayout}`);
  }
  const dest = payoutDestination(p);
  if (!dest) throw badInput("Add your bank account or UPI ID in Payout details first");
  if (await ExpertPayoutModel.exists({ expertId: p._id, status: "requested" })) {
    throw badInput("You already have a cashout being processed");
  }
  if (p.walletBalance < rupees) throw badInput("That's more than your available balance");

  const payout = await ExpertPayoutModel.create({
    payoutNo: `VP-${payoutCode()}`,
    expertId: p._id,
    amount: rupees,
    method: dest.method,
    destination: dest.destination,
  });
  // Guarded hold: the balance check and the debit are one atomic write, so two
  // quick requests can't both pass a stale balance check and overdraw.
  const held = await postLedger({
    expertId: p._id,
    type: "payout_hold",
    amount: -rupees,
    payoutId: payout._id,
    note: `Cashout ${payout.payoutNo}`,
    requireFunds: true,
  });
  if (held !== "posted") {
    await ExpertPayoutModel.deleteOne({ _id: payout._id });
    throw badInput("That's more than your available balance");
  }
  return payout;
}

export async function listPayouts(expertId: Types.ObjectId | string) {
  return ExpertPayoutModel.find({ expertId }).sort({ _id: -1 }).limit(100);
}

export async function listPayoutsForAdmin(status?: string | null) {
  return ExpertPayoutModel.find(status ? { status } : {}).sort({ status: 1, _id: -1 }).limit(200);
}

export async function markPayoutPaid(payoutId: string, reference: string, adminUserId: string, note = "") {
  if (!reference.trim()) throw badInput("Enter the bank / UPI transaction reference");
  const payout = await ExpertPayoutModel.findOneAndUpdate(
    { _id: payoutId, status: "requested" },
    {
      $set: {
        status: "paid",
        reference: reference.trim(),
        adminNote: note.trim(),
        processedAt: new Date(),
        processedBy: adminUserId,
      },
    },
    { new: true },
  );
  if (!payout) throw badInput("This cashout isn't awaiting payment");
  return payout;
}

export async function rejectPayout(payoutId: string, note: string, adminUserId: string) {
  if (!note.trim()) throw badInput("Tell the expert why the cashout was rejected");
  const payout = await ExpertPayoutModel.findOneAndUpdate(
    { _id: payoutId, status: "requested" },
    { $set: { status: "rejected", adminNote: note.trim(), processedAt: new Date(), processedBy: adminUserId } },
    { new: true },
  );
  if (!payout) throw badInput("This cashout isn't awaiting payment");
  await postLedger({
    expertId: payout.expertId,
    type: "payout_release",
    amount: payout.amount,
    payoutId: payout._id,
    note: `Cashout ${payout.payoutNo} rejected — funds returned`,
  });
  return payout;
}

// ─── Dashboard ────────────────────────────────────────────────────────────

export async function expertDashboard(expertId: Types.ObjectId | string) {
  const profile = await ExpertProfileModel.findById(expertId);
  if (!profile) throw notFound("Expert");
  const today = nowInZone().date;
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  const [upcoming, awaitingConfirmation, pendingPayout, monthAgg] = await Promise.all([
    ConsultationBookingModel.countDocuments({
      expertId,
      date: { $gte: today },
      status: { $in: ["confirmed", "reschedule_proposed"] },
    }),
    ConsultationBookingModel.countDocuments({ expertId, status: "requested" }),
    ExpertPayoutModel.aggregate<{ total: number }>([
      { $match: { expertId: profile._id, status: "requested" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    ExpertLedgerModel.aggregate<{ total: number }>([
      {
        $match: {
          expertId: profile._id,
          type: { $in: ["booking_credit", "booking_reversal"] },
          createdAt: { $gte: monthStart },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const settings = await getMarketplaceSettings();
  return {
    profile,
    walletBalance: profile.walletBalance,
    lifetimeEarnings: profile.lifetimeEarnings,
    monthEarnings: monthAgg[0]?.total ?? 0,
    pendingPayout: pendingPayout[0]?.total ?? 0,
    upcomingCount: upcoming,
    awaitingConfirmationCount: awaitingConfirmation,
    commissionPct: profile.commissionPct ?? settings.commissionPct,
    minPayout: settings.minPayout,
  };
}

// ─── Reviews ──────────────────────────────────────────────────────────────

export async function addReview(
  booking: ConsultationBookingDoc,
  rating: number,
  comment: string,
) {
  if (!booking.expertId) throw badInput("This booking has no expert to review");
  if (booking.status !== "completed") throw badInput("You can review once the session is completed");
  if (booking.reviewed) throw badInput("You've already reviewed this booking");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw badInput("Rating must be 1–5 stars");
  try {
    await ExpertReviewModel.create({
      expertId: booking.expertId,
      bookingId: booking._id,
      authorName: booking.name.split(" ")[0] || booking.name,
      rating,
      comment: comment.trim().slice(0, 1000),
    });
  } catch (err) {
    if (isDupKey(err)) throw badInput("You've already reviewed this booking");
    throw err;
  }
  booking.reviewed = true;
  await booking.save();
  await recomputeRating(booking.expertId);
  refreshPublicExperts();
  return booking;
}

async function recomputeRating(expertId: Types.ObjectId | string) {
  const [agg] = await ExpertReviewModel.aggregate<{ avg: number; count: number }>([
    { $match: { expertId: new Types.ObjectId(String(expertId)), hidden: false } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await ExpertProfileModel.updateOne(
    { _id: expertId },
    { $set: { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg?.count ?? 0 } },
  );
}

export async function listReviews(expertId: Types.ObjectId | string, limit = 20) {
  return ExpertReviewModel.find({ expertId, hidden: false }).sort({ _id: -1 }).limit(limit);
}

export async function setReviewHidden(reviewId: string, hidden: boolean) {
  const r = await ExpertReviewModel.findByIdAndUpdate(reviewId, { $set: { hidden } }, { new: true });
  if (!r) throw notFound("Review");
  await recomputeRating(r.expertId);
  refreshPublicExperts();
  return r;
}

// ─── Admin ────────────────────────────────────────────────────────────────

export async function listExpertsForAdmin(filter: { status?: ExpertStatus | null; search?: string | null }) {
  const q: FilterQuery<ExpertProfile> = {};
  if (filter.status) q.status = filter.status;
  if (filter.search?.trim()) {
    const rx = searchRegex(filter.search);
    q.$or = [{ displayName: rx }, { slug: rx }, { city: rx }, { phone: rx }];
  }
  return ExpertProfileModel.find(q).sort({ status: 1, createdAt: -1 }).limit(500);
}

export async function getExpertForAdmin(id: string) {
  const p = await ExpertProfileModel.findById(id);
  if (!p) throw notFound("Expert");
  return p;
}

export async function setExpertStatus(id: string, status: ExpertStatus, note = "") {
  const p = await getExpertForAdmin(id);
  if ((status === "rejected" || status === "suspended") && !note.trim()) {
    throw badInput("Add a note — the expert will see it");
  }
  p.status = status;
  p.statusNote = note.trim();
  if (status === "approved" && !p.approvedAt) p.approvedAt = new Date();
  await p.save();
  refreshPublicExperts();
  return p;
}

export async function setExpertCommission(id: string, pct: number | null) {
  if (pct != null && (pct < 0 || pct > 100)) throw badInput("Commission must be 0–100%");
  const p = await getExpertForAdmin(id);
  p.set("commissionPct", pct);
  await p.save();
  return p;
}

/** Profile + user email for the panel / admin views. */
export async function expertEmail(expertId: Types.ObjectId | string): Promise<string | null> {
  const p = await ExpertProfileModel.findById(expertId).select("userId");
  if (!p) return null;
  const u = await UserModel.findById(p.userId).select("email");
  return u?.email ?? null;
}
