import crypto from "node:crypto";
import type { FilterQuery, UpdateQuery } from "mongoose";
import { customAlphabet } from "nanoid";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { badInput, notFound } from "../../shared/errors.js";
import { searchRegex } from "../../graphql/admin-common.js";
import { notifyFrontendRevalidate } from "../../shared/http/revalidate-client.js";
import type { Locale } from "../../shared/localized.js";
import { getPaymentProvider } from "../payment/payment.provider.js";
import {
  CONSULTATION_SERVICE_KEYS,
  ConsultationBookingModel,
  ConsultationServiceModel,
  PoojaServiceModel,
  type BookingKind,
  type BookingStatus,
  type ConsultationBooking,
  type ConsultationBookingDoc,
  type ConsultationServiceDoc,
  type PoojaServiceDoc,
} from "./consultation.model.js";
import { getMeetingProvider } from "./meeting.provider.js";
import { daysBetween, localDateTime, nowInZone, slotMinutes } from "./booking-time.js";
import {
  addReview,
  computeSplit,
  creditBookingEarning,
  expertAvailableSlots,
  expertHasClash,
  getActiveOffering,
  expertEmail,
  getExpertBySlug,
  reverseBookingEarning,
} from "../expert/expert.service.js";
import { ExpertProfileModel } from "../expert/expert.model.js";
import {
  sendBookingConfirmed,
  sendBookingReceived,
  sendBookingRefunded,
  sendRecordingReady,
  sendRescheduleProposed,
  sendExpertNewBooking,
} from "./booking.emails.js";

/** Consultation slots per working day (closed Sundays). */
export const DAILY_SLOTS = [
  "09:30",
  "10:30",
  "11:30",
  "12:30",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
] as const;

/** Pooja muhurat slots — performed every day, including Sundays. */
export const POOJA_SLOTS = ["06:30", "08:00", "09:30", "11:00", "16:30", "18:00"] as const;

/** Today's slots must start at least this far ahead so the team can prepare. */
const SAME_DAY_LEAD_MINS = 60;
/** How far ahead bookings may be made. */
const MAX_DAYS_AHEAD = 120;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bookingCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);
const generateBookingNo = () => `VB-${bookingCode()}`;

// ─── Catalog ──────────────────────────────────────────────────────────────

export async function listServices() {
  return ConsultationServiceModel.find({ active: true }).sort({ order: 1 });
}

export async function listPoojas(): Promise<PoojaServiceDoc[]> {
  return PoojaServiceModel.find({ active: true }).sort({ order: 1 });
}

export async function getPooja(slug: string): Promise<PoojaServiceDoc | null> {
  return PoojaServiceModel.findOne({ slug: slug.toLowerCase(), active: true });
}

async function resolveService(kind: BookingKind, key: string) {
  if (kind === "pooja") {
    const p = await getPooja(key);
    if (!p) throw badInput("Unknown pooja");
    return { name: p.name, durationMins: p.durationMins, price: p.price };
  }
  if (!(CONSULTATION_SERVICE_KEYS as readonly string[]).includes(key)) {
    throw badInput("Unknown consultation service");
  }
  const s = await ConsultationServiceModel.findOne({ key, active: true });
  if (!s) throw badInput("Unknown consultation service");
  return { name: s.name, durationMins: s.durationMins, price: s.price };
}

// ─── Slots ────────────────────────────────────────────────────────────────

function slotsFor(kind: BookingKind): readonly string[] {
  return kind === "pooja" ? POOJA_SLOTS : DAILY_SLOTS;
}

/**
 * Free slots for a date. A slot is taken by an awaiting/confirmed booking, by
 * an unpaid booking whose payment hold hasn't expired, or by a pending
 * reschedule *proposal* (the admin promised that slot to someone).
 */
export async function availableSlots(
  date: string,
  kind: BookingKind = "consultation",
  excludeId?: string,
): Promise<string[]> {
  if (!ISO_DATE.test(date)) throw badInput("date must be yyyy-mm-dd");
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw badInput("Invalid date");

  const now = nowInZone();
  const ahead = daysBetween(now.date, date);
  if (ahead < 0 || ahead > MAX_DAYS_AHEAD) return [];
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (kind === "consultation" && weekday === 0) return [];

  const holders = await ConsultationBookingModel.find({
    kind,
    // Expert bookings live on that expert's own calendar, not the platform grid.
    expertId: null,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [
      { date, status: { $in: ["requested", "confirmed"] } },
      { date, status: "pending_payment", holdExpiresAt: { $gt: new Date() } },
      { proposedDate: date, status: "reschedule_proposed" },
    ],
  }).select("date slot status proposedDate proposedSlot");
  const taken = new Set(
    holders.map((b) => (b.status === "reschedule_proposed" ? b.proposedSlot : b.slot)),
  );

  return slotsFor(kind).filter(
    (s) =>
      !taken.has(s) && (ahead > 0 || slotMinutes(s) >= now.minutes + SAME_DAY_LEAD_MINS),
  );
}

// ─── Customer: create & pay ───────────────────────────────────────────────

export type CreateBookingInput = {
  kind: BookingKind;
  serviceKey: string;
  date: string;
  slot: string;
  name: string;
  email: string;
  phone?: string;
  birthDetails?: { date?: string; time?: string; place?: string };
  sankalp?: {
    gotra?: string;
    nakshatra?: string;
    rashi?: string;
    familyMembers?: string[];
    purpose?: string;
  };
  notes?: string;
  /** Book this expert (marketplace) at their price; omit for a platform booking. */
  expertSlug?: string;
};

export type BookingCheckout = {
  booking: ConsultationBookingDoc;
  clientData: Record<string, unknown>;
  accessToken: string;
};

function historyEntry(status: BookingStatus, note: string) {
  return { status, at: new Date(), note };
}

/**
 * Creates a booking and opens the payment for it. The slot is held for
 * `BOOKING_HOLD_MINUTES` while the customer pays; free services skip payment
 * and go straight to `requested`.
 */
export async function createBooking(
  input: CreateBookingInput,
  opts: { userId?: string; locale?: Locale } = {},
): Promise<BookingCheckout> {
  const name = input.name.trim();
  const email = input.email.toLowerCase().trim();
  if (!name) throw badInput("Name is required");
  if (!EMAIL.test(email)) throw badInput("A valid email is required");

  const catalog = await resolveService(input.kind, input.serviceKey);
  let service = catalog;
  let expertFields: Record<string, unknown> = {};

  if (input.expertSlug) {
    // Marketplace booking: the expert's own price, duration and calendar.
    const expert = await getExpertBySlug(input.expertSlug);
    if (!expert) throw badInput("This expert isn't taking bookings right now");
    const offering = await getActiveOffering(expert._id, input.kind, input.serviceKey);
    if (!offering) throw badInput("This expert doesn't offer that service");
    const free = await expertAvailableSlots(expert, input.date, offering.durationMins);
    if (!free.includes(input.slot)) {
      throw badInput("That slot is no longer available — please pick another");
    }
    service = { name: catalog.name, durationMins: offering.durationMins, price: offering.price };
    const split = await computeSplit(offering.price, expert);
    expertFields = {
      expertId: expert._id,
      offeringId: offering._id,
      panditCount: offering.panditCount,
      samagriIncluded: offering.samagriIncluded,
      ...split,
    };
  } else {
    const free = await availableSlots(input.date, input.kind);
    if (!free.includes(input.slot)) {
      throw badInput("That slot is no longer available — please pick another");
    }
  }

  const isFree = service.price <= 0;
  const accessToken = crypto.randomBytes(18).toString("base64url");
  const holdExpiresAt = isFree ? null : new Date(Date.now() + env.BOOKING_HOLD_MINUTES * 60_000);
  const status: BookingStatus = isFree ? "requested" : "pending_payment";

  const booking = await ConsultationBookingModel.create({
    bookingNo: generateBookingNo(),
    kind: input.kind,
    serviceKey: input.kind === "pooja" ? input.serviceKey.toLowerCase() : input.serviceKey,
    serviceName: service.name,
    durationMins: service.durationMins,
    date: input.date,
    slot: input.slot,
    name,
    email,
    phone: input.phone?.trim() ?? "",
    birthDetails: {
      date: input.birthDetails?.date ?? "",
      time: input.birthDetails?.time ?? "",
      place: input.birthDetails?.place ?? "",
    },
    sankalp: {
      gotra: input.sankalp?.gotra?.trim() ?? "",
      nakshatra: input.sankalp?.nakshatra?.trim() ?? "",
      rashi: input.sankalp?.rashi?.trim() ?? "",
      familyMembers: (input.sankalp?.familyMembers ?? []).map((m) => m.trim()).filter(Boolean),
      purpose: input.sankalp?.purpose?.trim() ?? "",
    },
    notes: input.notes?.trim() ?? "",
    locale: opts.locale ?? "en",
    status,
    holdExpiresAt,
    amount: service.price,
    accessToken,
    history: [historyEntry(status, isFree ? "Booked (no payment required)" : "Awaiting payment")],
    userId: opts.userId ?? null,
    ...expertFields,
  });

  // Two customers can pass the availability check for the same slot at the
  // same moment. The earliest-created holder wins; later ones back out.
  let lost = false;
  if (booking.expertId) {
    lost = await expertHasClash(booking);
  } else {
    const contenders = await ConsultationBookingModel.find({
      kind: input.kind,
      expertId: null,
      date: input.date,
      slot: input.slot,
      $or: [
        { status: { $in: ["requested", "confirmed"] } },
        { status: "pending_payment", holdExpiresAt: { $gt: new Date() } },
      ],
    })
      .sort({ _id: 1 })
      .select("_id");
    lost = contenders.length > 1 && String(contenders[0]!._id) !== String(booking._id);
  }
  if (lost) {
    await ConsultationBookingModel.deleteOne({ _id: booking._id });
    throw badInput("That slot is no longer available — please pick another");
  }

  if (isFree) {
    void sendBookingReceived(booking);
    if (booking.expertId) void notifyExpertOfBooking(booking);
    return { booking, clientData: {}, accessToken };
  }

  const provider = getPaymentProvider();
  let intent;
  try {
    intent = await provider.createIntent({
      amount: service.price,
      currency: "INR",
      receipt: booking.bookingNo!,
      notes: { bookingNo: booking.bookingNo!, kind: input.kind },
    });
  } catch (err) {
    // Release the slot — the customer never got a chance to pay.
    await ConsultationBookingModel.deleteOne({ _id: booking._id });
    throw err;
  }
  const clientData = { ...intent.clientData, bookingNo: booking.bookingNo };
  booking.payment.provider = provider.name;
  booking.payment.providerRef = intent.ref;
  booking.payment.status = "created";
  booking.paymentClientData = clientData;
  await booking.save();

  if (intent.autoConfirm) {
    const paid = await confirmBookingPaid(
      { _id: booking._id },
      `mock_pay_${booking.bookingNo}`,
      "Payment confirmed",
    );
    return { booking: paid ?? booking, clientData, accessToken };
  }
  return { booking, clientData, accessToken };
}

/**
 * Atomically flips an unpaid booking to `requested`. Guarded by status in the
 * filter so the webhook and the client's own verify call — which race in
 * live traffic — can't both apply it (same pattern as `confirmOrderPaid`).
 * `cancelled` is accepted too: a payment captured after the hold expired and
 * the cleanup job cancelled the booking is still the customer's money.
 */
async function confirmBookingPaid(
  filter: FilterQuery<ConsultationBooking>,
  transactionId: string,
  note: string,
): Promise<ConsultationBookingDoc | null> {
  const before = await ConsultationBookingModel.findOne({
    ...filter,
    status: { $in: ["pending_payment", "cancelled"] },
    "payment.status": { $ne: "captured" },
  }).select("holdExpiresAt status");
  if (!before) return null;
  const late = before.status === "cancelled" || (before.holdExpiresAt && before.holdExpiresAt < new Date());

  const updated = await ConsultationBookingModel.findOneAndUpdate(
    { _id: before._id, status: before.status, "payment.status": { $ne: "captured" } },
    {
      $set: {
        status: "requested",
        "payment.status": "captured",
        "payment.transactionId": transactionId,
        holdExpiresAt: null,
      },
      $push: {
        history: historyEntry(
          "requested",
          late ? `${note} — paid after the slot hold expired, check for a clash` : note,
        ),
      },
    },
    { new: true },
  );
  if (updated) {
    if (late) logger.warn({ bookingNo: updated.bookingNo }, "Booking paid after hold expired");
    void sendBookingReceived(updated);
    if (updated.expertId) void notifyExpertOfBooking(updated);
  }
  return updated;
}

/** Webhook: returns whether `providerRef` belonged to a booking at all. */
export async function markBookingPaid(providerRef: string, transactionId = ""): Promise<boolean> {
  if (!providerRef) return false;
  const updated = await confirmBookingPaid(
    { "payment.providerRef": providerRef },
    transactionId,
    "Payment confirmed via webhook",
  );
  if (updated) return true;
  return Boolean(await ConsultationBookingModel.exists({ "payment.providerRef": providerRef }));
}

/** Webhook: a declined attempt. The customer can still retry within the hold. */
export async function markBookingFailed(providerRef: string): Promise<boolean> {
  if (!providerRef) return false;
  const res = await ConsultationBookingModel.updateOne(
    { "payment.providerRef": providerRef, status: "pending_payment" },
    { $set: { "payment.status": "failed" } },
  );
  if (res.matchedCount > 0) return true;
  return Boolean(await ConsultationBookingModel.exists({ "payment.providerRef": providerRef }));
}

export type BookingAccess = { userId?: string; token?: string | null };

/** Owner (logged in) or anyone holding the emailed access token may act on a booking. */
async function loadForCustomer(bookingNo: string, access: BookingAccess) {
  const b = await ConsultationBookingModel.findOne({ bookingNo });
  const tokenOk = Boolean(access.token && b?.accessToken && access.token === b.accessToken);
  const ownerOk = Boolean(access.userId && b?.userId && String(b.userId) === access.userId);
  if (!b || (!tokenOk && !ownerOk)) throw notFound("Booking");
  return b;
}

export async function getBookingForCustomer(bookingNo: string, access: BookingAccess) {
  return loadForCustomer(bookingNo, access);
}

export async function listMyBookings(userId: string): Promise<ConsultationBookingDoc[]> {
  return ConsultationBookingModel.find({ userId, status: { $ne: "cancelled" } }).sort({
    date: -1,
    slot: -1,
  });
}

/** Confirms payment from the client's Checkout success callback (signature-verified). */
export async function verifyBookingPayment(
  bookingNo: string,
  access: BookingAccess,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): Promise<ConsultationBookingDoc> {
  const b = await loadForCustomer(bookingNo, access);
  if (b.payment.providerRef !== razorpayOrderId) {
    throw badInput("Payment does not match this booking");
  }
  if (b.payment.status !== "captured") {
    if (
      !getPaymentProvider().verifyCheckoutSignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      )
    ) {
      throw badInput("Payment verification failed");
    }
    const updated = await confirmBookingPaid(
      { _id: b._id },
      razorpayPaymentId,
      "Payment confirmed by client",
    );
    if (updated) return updated;
  }
  return (await ConsultationBookingModel.findById(b._id))!;
}

/**
 * Re-opens checkout for an unpaid booking (e.g. the customer closed the
 * payment window) against the *same* gateway order, so a late capture of the
 * original attempt can never be orphaned.
 */
export async function resumeBookingPayment(
  bookingNo: string,
  access: BookingAccess,
): Promise<BookingCheckout> {
  const b = await loadForCustomer(bookingNo, access);
  if (b.status !== "pending_payment") throw badInput("This booking is not awaiting payment");
  if (!b.holdExpiresAt || b.holdExpiresAt < new Date()) {
    throw badInput("The payment window for this slot has expired — please book again");
  }
  const clientData = (b.paymentClientData as Record<string, unknown> | null) ?? {};
  return { booking: b, clientData, accessToken: b.accessToken };
}

/** Customer answers an admin's reschedule proposal: accept moves the booking, decline refunds it. */
export async function respondToReschedule(
  bookingNo: string,
  access: BookingAccess,
  accept: boolean,
): Promise<ConsultationBookingDoc> {
  const b = await loadForCustomer(bookingNo, access);
  if (b.status !== "reschedule_proposed") throw badInput("There is no pending reschedule to answer");
  if (!accept) return refundBookingDoc(b, "Customer declined the proposed time");

  const moved = await ConsultationBookingModel.findOneAndUpdate(
    { _id: b._id, status: "reschedule_proposed" },
    {
      $set: { date: b.proposedDate, slot: b.proposedSlot, proposedDate: "", proposedSlot: "" },
      $push: {
        history: historyEntry(
          "requested",
          `Customer accepted ${b.proposedDate} ${b.proposedSlot}`,
        ),
      },
    },
    { new: true },
  );
  if (!moved) throw badInput("This booking has already changed — please refresh");
  // The admin chose this slot, so accepting it is the confirmation.
  return finishConfirm(moved, "Confirmed at the rescheduled time");
}

// ─── Admin ────────────────────────────────────────────────────────────────

export type AdminBookingFilter = {
  status?: BookingStatus | null;
  kind?: BookingKind | null;
  serviceKey?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export async function listBookingsForAdmin(
  filter: AdminBookingFilter,
  skip: number,
  limit: number,
): Promise<{ items: ConsultationBookingDoc[]; total: number }> {
  const q: FilterQuery<ConsultationBooking> = {};
  if (filter.status) q.status = filter.status;
  if (filter.kind) {
    // Bookings made before `kind` existed are all consultations.
    q.kind = filter.kind === "consultation" ? { $in: ["consultation", null] } : filter.kind;
  }
  if (filter.serviceKey) q.serviceKey = filter.serviceKey;
  if (filter.search?.trim()) {
    const rx = searchRegex(filter.search);
    q.$or = [{ name: rx }, { email: rx }, { bookingNo: rx }];
  }
  if (filter.dateFrom || filter.dateTo) {
    const range: Record<string, string> = {};
    if (filter.dateFrom) range.$gte = filter.dateFrom;
    if (filter.dateTo) range.$lte = filter.dateTo;
    q.date = range as never;
  }
  const [items, total] = await Promise.all([
    ConsultationBookingModel.find(q).sort({ date: -1, slot: -1 }).skip(skip).limit(limit),
    ConsultationBookingModel.countDocuments(q),
  ]);
  return { items, total };
}

export async function getBookingForAdmin(id: string): Promise<ConsultationBookingDoc> {
  const doc = await ConsultationBookingModel.findById(id);
  if (!doc) throw notFound("Booking");
  return doc;
}

function meetingTimes(b: ConsultationBookingDoc) {
  const mins = b.durationMins || 45;
  return { start: localDateTime(b.date, b.slot), end: localDateTime(b.date, b.slot, mins) };
}

/**
 * Moves a `requested` booking to `confirmed`. Consultations get a video
 * meeting (Google Meet in production); poojas are performed on the devotee's
 * behalf, so they get no live link — the recording follows on completion.
 */
async function finishConfirm(
  b: ConsultationBookingDoc,
  note: string,
): Promise<ConsultationBookingDoc> {
  const set: UpdateQuery<ConsultationBooking>["$set"] = { status: "confirmed" };
  const provider = getMeetingProvider();
  let createdEventId: string | null = null;

  if ((b.kind ?? "consultation") === "consultation") {
    const { start, end } = meetingTimes(b);
    if (b.meeting?.eventId && b.meeting.provider === provider.name) {
      // Previously confirmed then rescheduled — move the existing event.
      await provider.rescheduleMeeting(b.meeting.eventId, start, end, env.BOOKING_TIMEZONE);
    } else {
      const expert = b.expertId ? await ExpertProfileModel.findById(b.expertId) : null;
      const expertMail = b.expertId ? await expertEmail(b.expertId) : null;
      const meeting = await provider.createMeeting({
        requestId: `${b.bookingNo ?? b._id}-${b.date}-${b.slot.replace(":", "")}`,
        summary: `Vastukosh — ${b.serviceName?.en ?? b.serviceKey}: ${b.name}${
          expert ? ` with ${expert.displayName}` : ""
        }`,
        description: [
          `Booking ${b.bookingNo ?? ""}`,
          b.phone ? `Phone: ${b.phone}` : "",
          b.birthDetails?.date
            ? `Birth: ${b.birthDetails.date} ${b.birthDetails.time ?? ""} ${b.birthDetails.place ?? ""}`
            : "",
          b.notes ? `Notes: ${b.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        start,
        end,
        timeZone: env.BOOKING_TIMEZONE,
        attendeeEmails: [b.email, ...(expertMail ? [expertMail] : [])],
      });
      createdEventId = meeting.eventId;
      set.meeting = meeting;
    }
  }

  const updated = await ConsultationBookingModel.findOneAndUpdate(
    { _id: b._id, status: b.status },
    { $set: set, $push: { history: historyEntry("confirmed", note) } },
    { new: true },
  );
  if (!updated) {
    // Someone else changed the booking meanwhile — don't leave a stray event behind.
    if (createdEventId) await provider.cancelMeeting(createdEventId).catch(() => {});
    throw badInput("This booking has already changed — please refresh");
  }
  void sendBookingConfirmed(updated);
  return updated;
}

export async function confirmBooking(id: string, note = ""): Promise<ConsultationBookingDoc> {
  const b = await getBookingForAdmin(id);
  if (b.status !== "requested") {
    throw badInput(
      b.status === "pending_payment"
        ? "This booking hasn't been paid yet"
        : `Cannot confirm a booking that is ${b.status}`,
    );
  }
  return finishConfirm(b, note || "Confirmed by admin");
}

export async function proposeReschedule(
  id: string,
  date: string,
  slot: string,
  note = "",
): Promise<ConsultationBookingDoc> {
  const b = await getBookingForAdmin(id);
  if (!["requested", "confirmed", "reschedule_proposed"].includes(b.status)) {
    throw badInput(`Cannot reschedule a booking that is ${b.status}`);
  }
  if (date === b.date && slot === b.slot) throw badInput("Pick a different date or time");
  const kind = (b.kind ?? "consultation") as BookingKind;
  const expert = b.expertId ? await ExpertProfileModel.findById(b.expertId) : null;
  const free = expert
    ? await expertAvailableSlots(expert, date, b.durationMins || 60, String(b._id))
    : await availableSlots(date, kind, String(b._id));
  if (!free.includes(slot)) throw badInput("That slot isn't available");

  const updated = await ConsultationBookingModel.findOneAndUpdate(
    { _id: b._id, status: b.status },
    {
      $set: {
        status: "reschedule_proposed",
        proposedDate: date,
        proposedSlot: slot,
        adminNote: note.trim(),
      },
      $push: {
        history: historyEntry("reschedule_proposed", `Proposed ${date} ${slot}${note ? ` — ${note}` : ""}`),
      },
    },
    { new: true },
  );
  if (!updated) throw badInput("This booking has already changed — please refresh");
  void sendRescheduleProposed(updated);
  return updated;
}

/** Marks a confirmed booking done; for poojas, records (and emails) the recording link. Re-callable to update the link. */
export async function completeBooking(
  id: string,
  recordingUrl?: string | null,
): Promise<ConsultationBookingDoc> {
  const b = await getBookingForAdmin(id);
  if (b.status !== "confirmed" && b.status !== "completed") {
    throw badInput(`Cannot complete a booking that is ${b.status}`);
  }
  const url = recordingUrl?.trim() ?? "";
  if (url && !/^https?:\/\/\S+$/i.test(url)) throw badInput("Recording link must be a http(s) URL");

  const newRecording = Boolean(url) && url !== b.recordingUrl;
  if (b.status === "completed" && !newRecording) return b;

  const firstCompletion = b.status !== "completed";
  b.status = "completed";
  if (url) b.recordingUrl = url;
  b.history.push(
    historyEntry("completed", newRecording ? "Completed — recording shared" : "Completed"),
  );
  await b.save();
  // The expert's share becomes withdrawable once the session is done.
  if (firstCompletion) await creditBookingEarning(b);
  if (newRecording) void sendRecordingReady(b);
  return b;
}

async function refundBookingDoc(
  b: ConsultationBookingDoc,
  note: string,
): Promise<ConsultationBookingDoc> {
  if (b.status === "refunded") throw badInput("This booking is already refunded");
  if (b.status === "pending_payment") throw badInput("Nothing has been paid yet — cancel it instead");

  const cancelMeeting = async () => {
    if (b.meeting?.eventId) {
      await getMeetingProvider()
        .cancelMeeting(b.meeting.eventId)
        .catch((err) => logger.error({ err, bookingNo: b.bookingNo }, "Meeting cancel failed"));
    }
  };

  if (b.payment.status !== "captured" || !b.payment.transactionId) {
    // Free (or legacy, pre-payment) booking — no money to send back.
    await cancelMeeting();
    b.status = "cancelled";
    b.history.push(historyEntry("cancelled", note));
    await b.save();
    return b;
  }

  // Claim the refund atomically so a double-click can't refund twice.
  const claimed = await ConsultationBookingModel.findOneAndUpdate(
    { _id: b._id, status: { $ne: "refunded" }, "payment.refundStatus": { $in: ["", "failed"] } },
    { $set: { "payment.refundStatus": "pending" } },
    { new: true },
  );
  if (!claimed) throw badInput("A refund for this booking is already in progress or complete");

  try {
    const result = await getPaymentProvider().refund(
      claimed.payment.transactionId,
      Math.round(claimed.amount * 100),
      { bookingNo: claimed.bookingNo ?? "" },
    );
    claimed.payment.refundId = result.refundId;
    claimed.payment.refundStatus = result.status;
    claimed.payment.refundAmount = claimed.amount;
    claimed.status = "refunded";
    claimed.history.push(historyEntry("refunded", note));
    await claimed.save();
  } catch (err) {
    claimed.payment.refundStatus = "failed";
    await claimed.save();
    throw err;
  }
  await cancelMeeting();
  // A refund after completion takes back the expert's already-credited share.
  await reverseBookingEarning(claimed);
  void sendBookingRefunded(claimed);
  return claimed;
}

export async function refundBooking(id: string, note = ""): Promise<ConsultationBookingDoc> {
  return refundBookingDoc(await getBookingForAdmin(id), note || "Refunded by admin");
}

/** Webhook: final settlement of a refund. Returns whether a booking matched. */
export async function syncBookingRefundStatus(
  refundId: string,
  status: "processed" | "failed",
): Promise<boolean> {
  const res = await ConsultationBookingModel.updateOne(
    { "payment.refundId": refundId },
    { $set: { "payment.refundStatus": status } },
  );
  return res.matchedCount > 0;
}

/**
 * The generic status setter is limited to moves that have no side effects.
 * Confirming (meeting link), rescheduling (customer consent) and refunding
 * (money) each go through their own mutation.
 */
export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<ConsultationBookingDoc> {
  const b = await getBookingForAdmin(id);
  if (status === "completed") return completeBooking(id, null);
  if (status === "cancelled") {
    if (b.payment.status === "captured" && b.status !== "refunded") {
      throw badInput("This booking was paid — refund it instead of cancelling");
    }
    if (b.meeting?.eventId) await getMeetingProvider().cancelMeeting(b.meeting.eventId).catch(() => {});
    b.status = "cancelled";
    b.history.push(historyEntry("cancelled", "Cancelled by admin"));
    await b.save();
    return b;
  }
  if (status === "requested" && b.status === "pending_payment" && b.payment.status !== "captured") {
    // Admin marking an offline/cash payment as received.
    b.status = "requested";
    b.holdExpiresAt = null as never;
    b.history.push(historyEntry("requested", "Marked as paid offline by admin"));
    await b.save();
    return b;
  }
  throw badInput(
    status === "confirmed"
      ? "Use confirmBooking to confirm (it creates the meeting link)"
      : status === "refunded"
        ? "Use refundBooking to refund"
        : status === "reschedule_proposed"
          ? "Use proposeBookingReschedule to reschedule"
          : `Cannot move a booking from ${b.status} to ${status}`,
  );
}

/** Cleanup job: cancels unpaid bookings whose slot hold has lapsed. */
export async function expireStaleHolds(): Promise<number> {
  const res = await ConsultationBookingModel.updateMany(
    { status: "pending_payment", holdExpiresAt: { $lt: new Date(Date.now() - 30 * 60_000) } },
    {
      $set: { status: "cancelled" },
      $push: { history: historyEntry("cancelled", "Payment not completed — slot released") },
    },
  );
  return res.modifiedCount;
}

// ─── Admin: catalogs ──────────────────────────────────────────────────────

export async function listServicesForAdmin(): Promise<ConsultationServiceDoc[]> {
  return ConsultationServiceModel.find().sort({ order: 1 });
}

/** Fee and duration sanity checks shared by both admin catalogs. */
function assertFeeAndDuration(input: Record<string, unknown>) {
  const { price, durationMins } = input;
  if (price != null && (typeof price !== "number" || !Number.isFinite(price) || price < 0)) {
    throw badInput("Fee must be zero or more");
  }
  if (
    durationMins != null &&
    (typeof durationMins !== "number" || !Number.isInteger(durationMins) || durationMins <= 0)
  ) {
    throw badInput("Duration must be a whole number of minutes");
  }
}

export async function upsertConsultationService(
  input: { key: string } & Record<string, unknown>,
): Promise<ConsultationServiceDoc> {
  assertFeeAndDuration(input);
  const doc = await ConsultationServiceModel.findOneAndUpdate(
    { key: input.key },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  void notifyFrontendRevalidate(["consultation-services"]);
  return doc;
}

export async function listPoojasForAdmin(): Promise<PoojaServiceDoc[]> {
  return PoojaServiceModel.find().sort({ order: 1 });
}

export async function upsertPoojaService(
  input: { slug: string } & Record<string, unknown>,
): Promise<PoojaServiceDoc> {
  assertFeeAndDuration(input);
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw badInput("Slug must be lowercase letters, numbers and dashes");
  }
  const existing = await PoojaServiceModel.exists({ slug });
  if (!existing && (!input.name || !input.description || input.price == null || !input.durationMins)) {
    throw badInput("A new pooja needs a name, description, price and duration");
  }
  const set = Object.fromEntries(
    Object.entries({ ...input, slug }).filter(([, v]) => v !== undefined && v !== null),
  );
  const doc = await PoojaServiceModel.findOneAndUpdate(
    { slug },
    { $set: set },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
  );
  void notifyFrontendRevalidate(["pooja-services"]);
  return doc;
}

// ─── Marketplace: experts acting on their own bookings ────────────────────

async function notifyExpertOfBooking(b: ConsultationBookingDoc) {
  const email = b.expertId ? await expertEmail(b.expertId) : null;
  if (email) await sendExpertNewBooking(b, email);
}

/** Loads a booking only if it belongs to this expert. */
async function loadForExpert(expertId: string, bookingNo: string): Promise<ConsultationBookingDoc> {
  const b = await ConsultationBookingModel.findOne({ bookingNo, expertId });
  if (!b) throw notFound("Booking");
  return b;
}

export type ExpertBookingScope = "action" | "upcoming" | "past";

export async function listExpertBookings(
  expertId: string,
  scope: ExpertBookingScope,
): Promise<ConsultationBookingDoc[]> {
  const today = nowInZone().date;
  if (scope === "action") {
    // Needs the expert: confirm new paid bookings, or awaiting the customer's reply.
    return ConsultationBookingModel.find({ expertId, status: { $in: ["requested", "reschedule_proposed"] } }).sort({
      date: 1,
      slot: 1,
    });
  }
  if (scope === "upcoming") {
    return ConsultationBookingModel.find({ expertId, status: "confirmed", date: { $gte: today } }).sort({
      date: 1,
      slot: 1,
    });
  }
  return ConsultationBookingModel.find({
    expertId,
    $or: [
      { status: { $in: ["completed", "refunded", "cancelled"] } },
      { status: "confirmed", date: { $lt: today } },
    ],
  })
    .sort({ date: -1, slot: -1 })
    .limit(200);
}

export async function expertConfirmBooking(expertId: string, bookingNo: string, note = "") {
  const b = await loadForExpert(expertId, bookingNo);
  return confirmBooking(String(b._id), note || "Confirmed by expert");
}

export async function expertProposeReschedule(
  expertId: string,
  bookingNo: string,
  date: string,
  slot: string,
  note = "",
) {
  const b = await loadForExpert(expertId, bookingNo);
  return proposeReschedule(String(b._id), date, slot, note);
}

export async function expertCompleteBooking(expertId: string, bookingNo: string, recordingUrl?: string | null) {
  const b = await loadForExpert(expertId, bookingNo);
  if (b.status === "confirmed" && b.date > nowInZone().date) {
    throw badInput("You can mark it completed on or after the session date");
  }
  return completeBooking(String(b._id), recordingUrl);
}

/** Admin: give a platform (no-expert) booking to an expert; their split is fixed from the booking amount. */
export async function assignBookingExpert(id: string, expertId: string) {
  const b = await getBookingForAdmin(id);
  if (b.expertId) throw badInput("This booking already has an expert");
  if (!["requested", "confirmed", "reschedule_proposed"].includes(b.status)) {
    throw badInput(`Cannot assign an expert to a booking that is ${b.status}`);
  }
  const expert = await ExpertProfileModel.findById(expertId);
  if (!expert || expert.status !== "approved") throw badInput("Choose an approved expert");
  const split = await computeSplit(b.amount, expert);
  b.set({ expertId: expert._id, ...split });
  b.history.push(historyEntry(b.status, `Assigned to ${expert.displayName}`));
  await b.save();
  void notifyExpertOfBooking(b);
  return b;
}

/** Customer rates the expert after a completed booking. */
export async function submitExpertReview(
  bookingNo: string,
  access: BookingAccess,
  rating: number,
  comment: string,
) {
  const b = await loadForCustomer(bookingNo, access);
  return addReview(b, rating, comment);
}
