import { builder } from "../../graphql/builder.js";
import type { Context } from "../../graphql/context.js";
import { badInput, forbidden } from "../../shared/errors.js";
import { ConsultationBookingRef } from "../consultation/consultation.schema.js";
import {
  expertCompleteBooking,
  expertConfirmBooking,
  expertProposeReschedule,
  listExpertBookings,
  submitExpertReview,
} from "../consultation/consultation.service.js";
import {
  ExpertLedgerRef,
  ExpertOfferingRef,
  ExpertPayoutRef,
  ExpertProfileRef,
  ExpertReviewRef,
  ExpertSpecialityEnum,
} from "./expert.refs.js";
import type { ExpertProfileDoc } from "./expert.model.js";
import {
  applyAsExpert,
  deleteMyOffering,
  expertAvailableSlots,
  expertDashboard,
  getActiveOffering,
  getExpertBySlug,
  getMyExpertProfile,
  listExperts,
  listLedger,
  listPayouts,
  listReviews,
  requestPayout,
  setMyAvailability,
  updateMyExpertKyc,
  updateMyExpertProfile,
  upsertMyOffering,
  type ExpertProfileInput,
} from "./expert.service.js";

const ExpertPageRef = builder
  .objectRef<{ items: ExpertProfileDoc[]; total: number }>("ExpertPage")
  .implement({
    fields: (t) => ({
      items: t.field({ type: [ExpertProfileRef], resolve: (p) => p.items }),
      total: t.exposeInt("total"),
    }),
  });

type Dashboard = Awaited<ReturnType<typeof expertDashboard>>;
const ExpertDashboardRef = builder.objectRef<Dashboard>("ExpertDashboard").implement({
  fields: (t) => ({
    profile: t.field({ type: ExpertProfileRef, resolve: (d) => d.profile }),
    walletBalance: t.exposeFloat("walletBalance"),
    lifetimeEarnings: t.exposeFloat("lifetimeEarnings"),
    monthEarnings: t.exposeFloat("monthEarnings"),
    pendingPayout: t.exposeFloat("pendingPayout"),
    upcomingCount: t.exposeInt("upcomingCount"),
    awaitingConfirmationCount: t.exposeInt("awaitingConfirmationCount"),
    /** Effective commission (override or marketplace default), %. */
    commissionPct: t.exposeFloat("commissionPct"),
    minPayout: t.exposeFloat("minPayout"),
  }),
});

const ExpertSortEnum = builder.enumType("ExpertSort", {
  values: ["rating", "price_low", "price_high", "experience"] as const,
});
const ExpertBookingScopeEnum = builder.enumType("ExpertBookingScope", {
  values: ["action", "upcoming", "past"] as const,
});

const ExpertFilterInput = builder.inputType("ExpertFilter", {
  fields: (t) => ({
    speciality: t.field({ type: ExpertSpecialityEnum, required: false }),
    serviceKey: t.string({ required: false, description: "Consultation key or pooja slug" }),
    language: t.string({ required: false }),
    search: t.string({ required: false }),
    sort: t.field({ type: ExpertSortEnum, required: false }),
  }),
});

const CertificateInput = builder.inputType("ExpertCertificateInput", {
  fields: (t) => ({
    title: t.string({ required: true }),
    issuer: t.string({ required: false }),
    year: t.int({ required: false }),
    url: t.string({ required: false }),
  }),
});

const ExpertProfileInputRef = builder.inputType("ExpertProfileInput", {
  fields: (t) => ({
    displayName: t.string({ required: false }),
    title: t.string({ required: false }),
    photoUrl: t.string({ required: false }),
    headline: t.string({ required: false }),
    bio: t.string({ required: false }),
    specialities: t.field({ type: [ExpertSpecialityEnum], required: false }),
    languages: t.stringList({ required: false }),
    experienceYears: t.int({ required: false }),
    city: t.string({ required: false }),
    state: t.string({ required: false }),
    phone: t.string({ required: false }),
    certificates: t.field({ type: [CertificateInput], required: false }),
  }),
});

const ExpertKycInputRef = builder.inputType("ExpertKycInput", {
  fields: (t) => ({
    legalName: t.string({ required: false }),
    panNumber: t.string({ required: false }),
    idType: t.string({ required: false }),
    idLast4: t.string({ required: false }),
    bankAccountName: t.string({ required: false }),
    bankAccountNumber: t.string({ required: false }),
    bankIfsc: t.string({ required: false }),
    upiId: t.string({ required: false }),
  }),
});

const AvailabilityWindowInput = builder.inputType("ExpertAvailabilityWindowInput", {
  fields: (t) => ({
    day: t.int({ required: true }),
    start: t.string({ required: true }),
    end: t.string({ required: true }),
  }),
});

const OfferingInputRef = builder.inputType("ExpertOfferingInput", {
  fields: (t) => ({
    kind: t.string({ required: true, description: "`consultation` or `pooja`" }),
    serviceKey: t.string({ required: true }),
    price: t.float({ required: true }),
    durationMins: t.int({ required: true }),
    panditCount: t.int({ required: false }),
    samagriIncluded: t.boolean({ required: false }),
    notes: t.string({ required: false }),
    active: t.boolean({ required: false }),
  }),
});

function profileInput(input: Record<string, unknown>): ExpertProfileInput {
  // GraphQL gives `null` for omitted optionals; the service treats undefined as "leave as is".
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== null && v !== undefined),
  ) as ExpertProfileInput;
}

/** The caller's expert profile id, or FORBIDDEN. */
async function requireExpert(ctx: Context): Promise<string> {
  const id = await ctx.expertId();
  if (!id) throw forbidden("Expert account required");
  return id;
}

export function registerExpertModule() {
  builder.queryFields((t) => ({
    // ── public directory ──
    experts: t.field({
      type: ExpertPageRef,
      args: {
        filter: t.arg({ type: ExpertFilterInput, required: false }),
        limit: t.arg.int({ required: false }),
        offset: t.arg.int({ required: false }),
      },
      resolve: (_p, { filter, limit, offset }) =>
        listExperts(
          {
            speciality: (filter?.speciality ?? null) as never,
            serviceKey: filter?.serviceKey ?? null,
            language: filter?.language ?? null,
            search: filter?.search ?? null,
            sort: (filter?.sort ?? null) as never,
          },
          Math.min(limit ?? 24, 60),
          Math.max(offset ?? 0, 0),
        ),
    }),
    expert: t.field({
      type: ExpertProfileRef,
      nullable: true,
      args: { slug: t.arg.string({ required: true }) },
      resolve: (_p, { slug }) => getExpertBySlug(slug),
    }),
    /** Free start times (IST) for this expert's offering on a date. */
    expertSlots: t.field({
      type: ["String"],
      args: {
        slug: t.arg.string({ required: true }),
        kind: t.arg.string({ required: true }),
        serviceKey: t.arg.string({ required: true }),
        date: t.arg.string({ required: true }),
      },
      resolve: async (_p, { slug, kind, serviceKey, date }) => {
        const expert = await getExpertBySlug(slug);
        if (!expert) return [];
        const offering = await getActiveOffering(expert._id, kind, serviceKey);
        if (!offering) return [];
        return expertAvailableSlots(expert, date, offering.durationMins);
      },
    }),
    expertReviews: t.field({
      type: [ExpertReviewRef],
      args: { slug: t.arg.string({ required: true }), limit: t.arg.int({ required: false }) },
      resolve: async (_p, { slug, limit }) => {
        const expert = await getExpertBySlug(slug);
        return expert ? listReviews(expert._id, Math.min(limit ?? 20, 50)) : [];
      },
    }),

    // ── the expert's own panel ──
    /** The signed-in user's expert profile, or null if they haven't applied. */
    myExpertProfile: t.field({
      type: ExpertProfileRef,
      nullable: true,
      authScopes: { loggedIn: true },
      resolve: (_p, _a, ctx) => getMyExpertProfile(ctx.user!.id).catch(() => null),
    }),
    myExpertDashboard: t.field({
      type: ExpertDashboardRef,
      authScopes: { expert: true },
      resolve: async (_p, _a, ctx) => expertDashboard(await requireExpert(ctx)),
    }),
    myExpertBookings: t.field({
      type: [ConsultationBookingRef],
      authScopes: { expert: true },
      args: { scope: t.arg({ type: ExpertBookingScopeEnum, required: true }) },
      resolve: async (_p, { scope }, ctx) => listExpertBookings(await requireExpert(ctx), scope),
    }),
    myExpertLedger: t.field({
      type: [ExpertLedgerRef],
      authScopes: { expert: true },
      resolve: async (_p, _a, ctx) => listLedger(await requireExpert(ctx)),
    }),
    myExpertPayouts: t.field({
      type: [ExpertPayoutRef],
      authScopes: { expert: true },
      resolve: async (_p, _a, ctx) => listPayouts(await requireExpert(ctx)),
    }),
  }));

  builder.mutationFields((t) => ({
    /** Join as an expert. Creates a profile pending admin approval; refresh your session to get panel access. */
    applyAsExpert: t.field({
      type: ExpertProfileRef,
      authScopes: { loggedIn: true },
      args: { input: t.arg({ type: ExpertProfileInputRef, required: true }) },
      resolve: async (_p, { input }, ctx) => {
        const profile = await applyAsExpert(ctx.user!.id, profileInput(input));
        // The auth check for this mutation already memoised "not an expert yet".
        ctx.resetExpertId();
        return profile;
      },
    }),
    updateMyExpertProfile: t.field({
      type: ExpertProfileRef,
      authScopes: { expert: true },
      args: { input: t.arg({ type: ExpertProfileInputRef, required: true }) },
      resolve: (_p, { input }, ctx) => updateMyExpertProfile(ctx.user!.id, profileInput(input)),
    }),
    updateMyExpertKyc: t.field({
      type: ExpertProfileRef,
      authScopes: { expert: true },
      args: { input: t.arg({ type: ExpertKycInputRef, required: true }) },
      resolve: (_p, { input }, ctx) => updateMyExpertKyc(ctx.user!.id, profileInput(input) as never),
    }),
    setMyAvailability: t.field({
      type: ExpertProfileRef,
      authScopes: { expert: true },
      args: {
        windows: t.arg({ type: [AvailabilityWindowInput], required: true }),
        daysOff: t.arg.stringList({ required: true }),
      },
      resolve: (_p, { windows, daysOff }, ctx) => setMyAvailability(ctx.user!.id, windows, daysOff),
    }),
    upsertMyOffering: t.field({
      type: ExpertOfferingRef,
      authScopes: { expert: true },
      args: { input: t.arg({ type: OfferingInputRef, required: true }) },
      resolve: (_p, { input }, ctx) => {
        if (input.kind !== "consultation" && input.kind !== "pooja") {
          throw badInput("Service type must be consultation or pooja");
        }
        return upsertMyOffering(ctx.user!.id, input as never);
      },
    }),
    deleteMyOffering: t.boolean({
      authScopes: { expert: true },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_p, { id }, ctx) => deleteMyOffering(ctx.user!.id, String(id)),
    }),
    requestPayout: t.field({
      type: ExpertPayoutRef,
      authScopes: { expert: true },
      args: { amount: t.arg.float({ required: true }) },
      resolve: (_p, { amount }, ctx) => requestPayout(ctx.user!.id, amount),
    }),
    expertConfirmBooking: t.field({
      type: ConsultationBookingRef,
      authScopes: { expert: true },
      args: { bookingNo: t.arg.string({ required: true }), note: t.arg.string({ required: false }) },
      resolve: async (_p, { bookingNo, note }, ctx) =>
        expertConfirmBooking(await requireExpert(ctx), bookingNo, note ?? ""),
    }),
    expertProposeReschedule: t.field({
      type: ConsultationBookingRef,
      authScopes: { expert: true },
      args: {
        bookingNo: t.arg.string({ required: true }),
        date: t.arg.string({ required: true }),
        slot: t.arg.string({ required: true }),
        note: t.arg.string({ required: false }),
      },
      resolve: async (_p, a, ctx) =>
        expertProposeReschedule(await requireExpert(ctx), a.bookingNo, a.date, a.slot, a.note ?? ""),
    }),
    expertCompleteBooking: t.field({
      type: ConsultationBookingRef,
      authScopes: { expert: true },
      args: {
        bookingNo: t.arg.string({ required: true }),
        recordingUrl: t.arg.string({ required: false }),
      },
      resolve: async (_p, { bookingNo, recordingUrl }, ctx) =>
        expertCompleteBooking(await requireExpert(ctx), bookingNo, recordingUrl),
    }),

    // ── customers ──
    /** Rate the expert after a completed booking (owner, or guest with the booking's token). */
    submitExpertReview: t.field({
      type: ConsultationBookingRef,
      args: {
        bookingNo: t.arg.string({ required: true }),
        token: t.arg.string({ required: false }),
        rating: t.arg.int({ required: true }),
        comment: t.arg.string({ required: false }),
      },
      resolve: (_p, a, ctx) =>
        submitExpertReview(a.bookingNo, { userId: ctx.user?.id, token: a.token }, a.rating, a.comment ?? ""),
    }),
  }));
}
