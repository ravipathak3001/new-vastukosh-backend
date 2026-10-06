import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import type { Context } from "../../graphql/context.js";
import {
  BOOKING_KINDS,
  BOOKING_STATUSES,
  CONSULTATION_SERVICE_KEYS,
  type ConsultationBookingDoc,
  type ConsultationServiceDoc,
  type PoojaServiceDoc,
} from "./consultation.model.js";
import {
  availableSlots,
  createBooking,
  getBookingForCustomer,
  getPooja,
  listMyBookings,
  listPoojas,
  listServices,
  respondToReschedule,
  resumeBookingPayment,
  verifyBookingPayment,
  type BookingAccess,
  type BookingCheckout,
  type CreateBookingInput,
} from "./consultation.service.js";

export const ServiceKeyEnum = builder.enumType("ConsultationServiceKey", {
  values: CONSULTATION_SERVICE_KEYS,
});

export const BookingStatusEnum = builder.enumType("BookingStatus", {
  values: BOOKING_STATUSES,
});

export const BookingKindEnum = builder.enumType("BookingKind", {
  values: BOOKING_KINDS,
});

export const ConsultationServiceRef = builder
  .objectRef<ConsultationServiceDoc>("ConsultationService")
  .implement({
    fields: (t) => ({
      key: t.field({ type: ServiceKeyEnum, resolve: (s) => s.key as never }),
      name: t.field({ type: LocalizedStringRef, resolve: (s) => s.name }),
      meta: t.field({ type: LocalizedStringRef, resolve: (s) => s.meta }),
      durationMins: t.exposeInt("durationMins"),
      price: t.exposeFloat("price"),
      icon: t.exposeString("icon"),
      order: t.exposeInt("order", { authScopes: { permission: "bookings.view" } }),
      active: t.exposeBoolean("active", { authScopes: { permission: "bookings.view" } }),
    }),
  });

export const PoojaServiceRef = builder.objectRef<PoojaServiceDoc>("PoojaService").implement({
  description: "An online pooja performed on the devotee's behalf; the recording is shared afterwards.",
  fields: (t) => ({
    slug: t.exposeString("slug"),
    name: t.field({ type: LocalizedStringRef, resolve: (p) => p.name }),
    description: t.field({ type: LocalizedStringRef, resolve: (p) => p.description }),
    durationMins: t.exposeInt("durationMins"),
    price: t.exposeFloat("price"),
    image: t.exposeString("image"),
    icon: t.exposeString("icon"),
    order: t.exposeInt("order", { authScopes: { permission: "bookings.view" } }),
    active: t.exposeBoolean("active", { authScopes: { permission: "bookings.view" } }),
  }),
});

const ConsultationBirthDetailsRef = builder
  .objectRef<NonNullable<ConsultationBookingDoc["birthDetails"]>>(
    "ConsultationBirthDetails",
  )
  .implement({
    fields: (t) => ({
      date: t.exposeString("date", { nullable: true }),
      time: t.exposeString("time", { nullable: true }),
      place: t.exposeString("place", { nullable: true }),
    }),
  });

const PoojaSankalpRef = builder
  .objectRef<NonNullable<ConsultationBookingDoc["sankalp"]>>("PoojaSankalp")
  .implement({
    fields: (t) => ({
      gotra: t.string({ resolve: (s) => s.gotra ?? "" }),
      nakshatra: t.string({ resolve: (s) => s.nakshatra ?? "" }),
      rashi: t.string({ resolve: (s) => s.rashi ?? "" }),
      familyMembers: t.stringList({ resolve: (s) => s.familyMembers ?? [] }),
      purpose: t.string({ resolve: (s) => s.purpose ?? "" }),
    }),
  });

type HistoryEntry = ConsultationBookingDoc["history"][number];
const BookingHistoryRef = builder.objectRef<HistoryEntry>("BookingHistoryEntry").implement({
  fields: (t) => ({
    status: t.field({ type: BookingStatusEnum, resolve: (h) => h.status as never }),
    at: t.field({ type: "DateTime", resolve: (h) => h.at }),
    note: t.string({ resolve: (h) => h.note ?? "" }),
  }),
});

export const ConsultationBookingRef = builder
  .objectRef<ConsultationBookingDoc>("ConsultationBooking")
  .implement({
    description: "A consultation or online-pooja booking.",
    fields: (t) => ({
      id: t.field({ type: "ID", resolve: (b) => String(b._id) }),
      bookingNo: t.string({ nullable: true, resolve: (b) => b.bookingNo ?? null }),
      kind: t.field({ type: BookingKindEnum, resolve: (b) => (b.kind ?? "consultation") as never }),
      /** Consultation service key (`astro`, `vastu`, `gem`) or pooja slug, depending on `kind`. */
      serviceKey: t.exposeString("serviceKey"),
      serviceName: t.field({
        type: LocalizedStringRef,
        nullable: true,
        resolve: (b) => (b.serviceName?.en ? b.serviceName : null),
      }),
      durationMins: t.int({ resolve: (b) => b.durationMins ?? 0 }),
      date: t.exposeString("date"),
      slot: t.exposeString("slot"),
      name: t.exposeString("name"),
      email: t.exposeString("email"),
      status: t.field({ type: BookingStatusEnum, resolve: (b) => b.status as never }),
      amount: t.float({ resolve: (b) => b.amount ?? 0 }),
      currency: t.string({ resolve: (b) => b.currency ?? "INR" }),
      paymentStatus: t.string({ resolve: (b) => b.payment?.status ?? "none" }),
      refundStatus: t.string({ resolve: (b) => b.payment?.refundStatus ?? "" }),
      refundAmount: t.float({ resolve: (b) => b.payment?.refundAmount ?? 0 }),
      /** Unpaid bookings hold their slot until this time. */
      holdExpiresAt: t.field({
        type: "DateTime",
        nullable: true,
        resolve: (b) => (b.status === "pending_payment" ? b.holdExpiresAt ?? null : null),
      }),
      /** Video link for a confirmed consultation. */
      meetingUrl: t.string({
        nullable: true,
        resolve: (b) =>
          b.meeting?.url && (b.status === "confirmed" || b.status === "completed")
            ? b.meeting.url
            : null,
      }),
      /** Pooja recording, shared once performed. */
      recordingUrl: t.string({ nullable: true, resolve: (b) => b.recordingUrl || null }),
      proposedDate: t.string({ nullable: true, resolve: (b) => b.proposedDate || null }),
      proposedSlot: t.string({ nullable: true, resolve: (b) => b.proposedSlot || null }),
      /** Message from the team (e.g. why a reschedule was proposed). */
      adminNote: t.string({ nullable: true, resolve: (b) => b.adminNote || null }),
      createdAt: t.field({ type: "DateTime", resolve: (b) => (b as any).createdAt }),
      phone: t.exposeString("phone", { authScopes: { permission: "bookings.view" } }),
      notes: t.exposeString("notes", { authScopes: { permission: "bookings.view" } }),
      userId: t.field({
        type: "ID",
        nullable: true,
        authScopes: { permission: "bookings.view" },
        resolve: (b) => (b.userId ? String(b.userId) : null),
      }),
      birthDetails: t.field({
        type: ConsultationBirthDetailsRef,
        nullable: true,
        authScopes: { permission: "bookings.view" },
        resolve: (b) => b.birthDetails ?? null,
      }),
      sankalp: t.field({
        type: PoojaSankalpRef,
        nullable: true,
        authScopes: { permission: "bookings.view" },
        resolve: (b) => (b.kind === "pooja" ? b.sankalp ?? null : null),
      }),
      paymentProvider: t.string({
        authScopes: { permission: "bookings.view" },
        resolve: (b) => b.payment?.provider ?? "",
      }),
      transactionId: t.string({
        authScopes: { permission: "bookings.view" },
        resolve: (b) => b.payment?.transactionId ?? "",
      }),
      meetingProvider: t.string({
        nullable: true,
        authScopes: { permission: "bookings.view" },
        resolve: (b) => b.meeting?.provider ?? null,
      }),
      history: t.field({
        type: [BookingHistoryRef],
        authScopes: { permission: "bookings.view" },
        resolve: (b) => b.history ?? [],
      }),
    }),
  });

const BookingCheckoutRef = builder.objectRef<BookingCheckout>("BookingCheckout").implement({
  fields: (t) => ({
    booking: t.field({ type: ConsultationBookingRef, resolve: (r) => r.booking }),
    /** Provider-specific payload the payment SDK needs (`{}` when nothing is due). */
    clientData: t.field({ type: "JSON", resolve: (r) => r.clientData }),
    /**
     * Secret that lets a guest view/act on this booking (also in every booking
     * email link). Keep it with the booking number; never show it publicly.
     */
    accessToken: t.exposeString("accessToken"),
  }),
});

const BirthDetailsInput = builder.inputType("ConsultationBirthDetailsInput", {
  fields: (t) => ({
    date: t.string({ required: false }),
    time: t.string({ required: false }),
    place: t.string({ required: false }),
  }),
});

const SankalpInput = builder.inputType("PoojaSankalpInput", {
  fields: (t) => ({
    gotra: t.string({ required: false }),
    nakshatra: t.string({ required: false }),
    rashi: t.string({ required: false }),
    familyMembers: t.stringList({ required: false }),
    purpose: t.string({ required: false }),
  }),
});

const CreateBookingInputRef = builder.inputType("CreateBookingInput", {
  fields: (t) => ({
    kind: t.field({ type: BookingKindEnum, required: true }),
    /** Consultation service key or pooja slug. */
    serviceKey: t.string({ required: true }),
    date: t.string({ required: true }),
    slot: t.string({ required: true }),
    name: t.string({ required: true }),
    email: t.string({ required: true }),
    phone: t.string({ required: false }),
    birthDetails: t.field({ type: BirthDetailsInput, required: false }),
    sankalp: t.field({ type: SankalpInput, required: false }),
    notes: t.string({ required: false }),
  }),
});

const BookConsultationInputRef = builder.inputType("BookConsultationInput", {
  fields: (t) => ({
    serviceKey: t.field({ type: ServiceKeyEnum, required: true }),
    date: t.string({ required: true }),
    slot: t.string({ required: true }),
    name: t.string({ required: true }),
    email: t.string({ required: true }),
    phone: t.string({ required: false }),
    birthDetails: t.field({ type: BirthDetailsInput, required: false }),
    notes: t.string({ required: false }),
  }),
});

type BirthIn = { date?: string | null; time?: string | null; place?: string | null } | null | undefined;
const birth = (b: BirthIn) =>
  b
    ? { date: b.date ?? undefined, time: b.time ?? undefined, place: b.place ?? undefined }
    : undefined;

function access(ctx: Context, token?: string | null): BookingAccess {
  return { userId: ctx.user?.id, token };
}

export function registerConsultationModule() {
  builder.queryFields((t) => ({
    consultationServices: t.field({
      type: [ConsultationServiceRef],
      resolve: () => listServices(),
    }),
    poojaServices: t.field({
      type: [PoojaServiceRef],
      resolve: () => listPoojas(),
    }),
    poojaService: t.field({
      type: PoojaServiceRef,
      nullable: true,
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }) => getPooja(slug),
    }),
    availableSlots: t.field({
      type: ["String"],
      args: {
        date: t.arg.string({ required: true }),
        kind: t.arg({ type: BookingKindEnum, required: false }),
      },
      resolve: (_p, { date, kind }) => availableSlots(date, (kind ?? "consultation") as never),
    }),
    myBookings: t.field({
      type: [ConsultationBookingRef],
      authScopes: { loggedIn: true },
      resolve: (_p, _a, ctx) => listMyBookings(ctx.user!.id),
    }),
    /** A single booking — for its owner, or anyone holding its access token (emailed link). */
    booking: t.field({
      type: ConsultationBookingRef,
      nullable: true,
      args: {
        bookingNo: t.arg.string({ required: true }),
        token: t.arg.string({ required: false }),
      },
      resolve: (_p, { bookingNo, token }, ctx) =>
        getBookingForCustomer(bookingNo, access(ctx, token)).catch(() => null),
    }),
  }));

  builder.mutationFields((t) => ({
    /**
     * Books a consultation or pooja and opens its payment. Complete the charge
     * with `clientData` (Razorpay Checkout), then call `verifyBookingPayment`.
     * With the mock provider the booking comes back already paid.
     */
    createBooking: t.field({
      type: BookingCheckoutRef,
      args: { input: t.arg({ type: CreateBookingInputRef, required: true }) },
      resolve: (_p, { input }, ctx) => {
        const payload: CreateBookingInput = {
          kind: input.kind as never,
          serviceKey: input.serviceKey,
          date: input.date,
          slot: input.slot,
          name: input.name,
          email: input.email,
          phone: input.phone ?? undefined,
          birthDetails: birth(input.birthDetails),
          sankalp: input.sankalp
            ? {
                gotra: input.sankalp.gotra ?? undefined,
                nakshatra: input.sankalp.nakshatra ?? undefined,
                rashi: input.sankalp.rashi ?? undefined,
                familyMembers: input.sankalp.familyMembers ?? undefined,
                purpose: input.sankalp.purpose ?? undefined,
              }
            : undefined,
          notes: input.notes ?? undefined,
        };
        return createBooking(payload, { userId: ctx.user?.id, locale: ctx.locale });
      },
    }),

    bookConsultation: t.field({
      type: ConsultationBookingRef,
      deprecationReason: "Use createBooking, which also returns the payment payload.",
      args: { input: t.arg({ type: BookConsultationInputRef, required: true }) },
      resolve: async (_p, { input }, ctx) =>
        (
          await createBooking(
            {
              kind: "consultation",
              serviceKey: input.serviceKey,
              date: input.date,
              slot: input.slot,
              name: input.name,
              email: input.email,
              phone: input.phone ?? undefined,
              birthDetails: birth(input.birthDetails),
              notes: input.notes ?? undefined,
            },
            { userId: ctx.user?.id, locale: ctx.locale },
          )
        ).booking,
    }),

    /** Confirms a Razorpay payment from the client's Checkout success callback. */
    verifyBookingPayment: t.field({
      type: ConsultationBookingRef,
      args: {
        bookingNo: t.arg.string({ required: true }),
        token: t.arg.string({ required: false }),
        razorpayOrderId: t.arg.string({ required: true }),
        razorpayPaymentId: t.arg.string({ required: true }),
        razorpaySignature: t.arg.string({ required: true }),
      },
      resolve: (_p, a, ctx) =>
        verifyBookingPayment(
          a.bookingNo,
          access(ctx, a.token),
          a.razorpayOrderId,
          a.razorpayPaymentId,
          a.razorpaySignature,
        ),
    }),

    /** Re-opens checkout for an unpaid booking whose slot hold is still valid. */
    resumeBookingPayment: t.field({
      type: BookingCheckoutRef,
      args: {
        bookingNo: t.arg.string({ required: true }),
        token: t.arg.string({ required: false }),
      },
      resolve: (_p, { bookingNo, token }, ctx) => resumeBookingPayment(bookingNo, access(ctx, token)),
    }),

    /** Accept the admin's proposed new time (confirms the booking) or decline it (full refund). */
    respondToBookingReschedule: t.field({
      type: ConsultationBookingRef,
      args: {
        bookingNo: t.arg.string({ required: true }),
        token: t.arg.string({ required: false }),
        accept: t.arg.boolean({ required: true }),
      },
      resolve: (_p, { bookingNo, token, accept }, ctx) =>
        respondToReschedule(bookingNo, access(ctx, token), accept),
    }),
  }));
}
