import { builder } from "../../graphql/builder.js";
import type { Context } from "../../graphql/context.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import { ConsultationServiceModel, PoojaServiceModel } from "../consultation/consultation.model.js";
import {
  EXPERT_SPECIALITIES,
  EXPERT_STATUSES,
  LEDGER_TYPES,
  PAYOUT_STATUSES,
  type ExpertLedgerDoc,
  type ExpertOfferingDoc,
  type ExpertPayoutDoc,
  type ExpertProfileDoc,
  type ExpertReviewDoc,
  type MarketplaceSettings,
} from "./expert.model.js";
import { expertEmail, listOfferings } from "./expert.service.js";

/**
 * GraphQL object types for the marketplace. Kept apart from the operations so
 * the booking schema can reference `Expert` without a circular import.
 *
 * Visibility: public profile fields are open; anything private (KYC, wallet,
 * schedule, status notes) resolves only for the expert themself or staff with
 * `experts.view`.
 */

export const ExpertStatusEnum = builder.enumType("ExpertStatus", { values: EXPERT_STATUSES });
export const ExpertSpecialityEnum = builder.enumType("ExpertSpeciality", { values: EXPERT_SPECIALITIES });
export const LedgerTypeEnum = builder.enumType("ExpertLedgerType", { values: LEDGER_TYPES });
export const PayoutStatusEnum = builder.enumType("ExpertPayoutStatus", { values: PAYOUT_STATUSES });

/** Field guard: the expert who owns `expertId`, or staff with `experts.view`. */
export function ownerOrStaff(expertIdOf: (parent: any) => unknown) {
  return async (parent: unknown, _args: unknown, ctx: Context) =>
    (await ctx.expertId()) === String(expertIdOf(parent)) ? true : { permission: "experts.view" };
}

const AvailabilityWindowRef = builder
  .objectRef<{ day: number; start: string; end: string }>("ExpertAvailabilityWindow")
  .implement({
    fields: (t) => ({
      day: t.exposeInt("day", { description: "0 = Sunday … 6 = Saturday" }),
      start: t.exposeString("start"),
      end: t.exposeString("end"),
    }),
  });

const CertificateRef = builder
  .objectRef<{ title: string; issuer?: string | null; year?: number | null; url?: string | null }>(
    "ExpertCertificate",
  )
  .implement({
    fields: (t) => ({
      title: t.exposeString("title"),
      issuer: t.string({ resolve: (c) => c.issuer ?? "" }),
      year: t.int({ nullable: true, resolve: (c) => c.year ?? null }),
      url: t.string({ resolve: (c) => c.url ?? "" }),
    }),
  });

type Kyc = NonNullable<ExpertProfileDoc["kyc"]>;
const ExpertKycRef = builder.objectRef<Kyc>("ExpertKyc").implement({
  fields: (t) => ({
    legalName: t.string({ resolve: (k) => k.legalName ?? "" }),
    panNumber: t.string({ resolve: (k) => k.panNumber ?? "" }),
    idType: t.string({ resolve: (k) => k.idType ?? "" }),
    idLast4: t.string({ resolve: (k) => k.idLast4 ?? "" }),
    bankAccountName: t.string({ resolve: (k) => k.bankAccountName ?? "" }),
    bankAccountNumber: t.string({ resolve: (k) => k.bankAccountNumber ?? "" }),
    bankIfsc: t.string({ resolve: (k) => k.bankIfsc ?? "" }),
    upiId: t.string({ resolve: (k) => k.upiId ?? "" }),
    /** True once a payout destination (bank or UPI) is on file. */
    payoutReady: t.boolean({
      resolve: (k) => Boolean((k.bankAccountNumber && k.bankIfsc) || k.upiId),
    }),
  }),
});

export const ExpertOfferingRef = builder.objectRef<ExpertOfferingDoc>("ExpertOffering").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (o) => String(o._id) }),
    kind: t.exposeString("kind"),
    serviceKey: t.exposeString("serviceKey"),
    /** Catalog name of the consultation / pooja. */
    serviceName: t.field({
      type: LocalizedStringRef,
      nullable: true,
      resolve: async (o) => {
        const doc =
          o.kind === "pooja"
            ? await PoojaServiceModel.findOne({ slug: o.serviceKey }).select("name")
            : await ConsultationServiceModel.findOne({ key: o.serviceKey }).select("name");
        return doc?.name ?? null;
      },
    }),
    price: t.exposeFloat("price"),
    durationMins: t.exposeInt("durationMins"),
    panditCount: t.int({ resolve: (o) => o.panditCount ?? 1 }),
    samagriIncluded: t.boolean({ resolve: (o) => o.samagriIncluded ?? false }),
    notes: t.string({ resolve: (o) => o.notes ?? "" }),
    active: t.exposeBoolean("active"),
  }),
});

export const ExpertProfileRef = builder.objectRef<ExpertProfileDoc>("Expert").implement({
  description: "A pandit / astrologer / Vastu or gemstone expert on the marketplace.",
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (p) => String(p._id) }),
    slug: t.exposeString("slug"),
    displayName: t.exposeString("displayName"),
    title: t.string({ resolve: (p) => p.title ?? "" }),
    photoUrl: t.string({ resolve: (p) => p.photoUrl ?? "" }),
    headline: t.string({ resolve: (p) => p.headline ?? "" }),
    bio: t.string({ resolve: (p) => p.bio ?? "" }),
    specialities: t.field({ type: [ExpertSpecialityEnum], resolve: (p) => p.specialities as never }),
    languages: t.stringList({ resolve: (p) => p.languages ?? [] }),
    experienceYears: t.int({ resolve: (p) => p.experienceYears ?? 0 }),
    city: t.string({ resolve: (p) => p.city ?? "" }),
    state: t.string({ resolve: (p) => p.state ?? "" }),
    certificates: t.field({ type: [CertificateRef], resolve: (p) => p.certificates ?? [] }),
    ratingAvg: t.float({ resolve: (p) => p.ratingAvg ?? 0 }),
    ratingCount: t.int({ resolve: (p) => p.ratingCount ?? 0 }),
    completedCount: t.int({ resolve: (p) => p.completedCount ?? 0 }),
    /** Weekdays (0 = Sun) the expert takes bookings — lets calendars grey out the rest. */
    workingDays: t.intList({
      resolve: (p) => [...new Set((p.availability ?? []).map((w) => w.day))].sort(),
    }),
    /** Upcoming dates the expert is away (yyyy-mm-dd). */
    unavailableDates: t.stringList({
      resolve: (p) => {
        const today = new Date().toISOString().slice(0, 10);
        return (p.daysOff ?? []).filter((d) => d >= today);
      },
    }),
    /** Bookable services. The owner and staff also see inactive ones. */
    offerings: t.field({
      type: [ExpertOfferingRef],
      resolve: async (p, _a, ctx) => {
        const isOwner = (await ctx.expertId()) === String(p._id);
        const isStaff = ctx.user?.permissions.includes("experts.view") ?? false;
        return listOfferings(p._id, !(isOwner || isStaff));
      },
    }),

    // ── private ──
    status: t.field({
      type: ExpertStatusEnum,
      authScopes: ownerOrStaff((p) => p._id),
      resolve: (p) => p.status as never,
    }),
    statusNote: t.string({ authScopes: ownerOrStaff((p) => p._id), resolve: (p) => p.statusNote ?? "" }),
    email: t.string({
      nullable: true,
      authScopes: ownerOrStaff((p) => p._id),
      resolve: (p) => expertEmail(p._id),
    }),
    phone: t.string({ authScopes: ownerOrStaff((p) => p._id), resolve: (p) => p.phone ?? "" }),
    kyc: t.field({
      type: ExpertKycRef,
      authScopes: ownerOrStaff((p) => p._id),
      resolve: (p) => (p.kyc ?? {}) as Kyc,
    }),
    availability: t.field({
      type: [AvailabilityWindowRef],
      authScopes: ownerOrStaff((p) => p._id),
      resolve: (p) => p.availability ?? [],
    }),
    daysOff: t.stringList({ authScopes: ownerOrStaff((p) => p._id), resolve: (p) => p.daysOff ?? [] }),
    /** Per-expert override; null = marketplace default. */
    commissionPct: t.float({
      nullable: true,
      authScopes: ownerOrStaff((p) => p._id),
      resolve: (p) => p.commissionPct ?? null,
    }),
    walletBalance: t.float({ authScopes: ownerOrStaff((p) => p._id), resolve: (p) => p.walletBalance ?? 0 }),
    lifetimeEarnings: t.float({
      authScopes: ownerOrStaff((p) => p._id),
      resolve: (p) => p.lifetimeEarnings ?? 0,
    }),
    createdAt: t.field({
      type: "DateTime",
      authScopes: ownerOrStaff((p) => p._id),
      resolve: (p) => (p as any).createdAt,
    }),
  }),
});

export const ExpertReviewRef = builder.objectRef<ExpertReviewDoc>("ExpertReview").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (r) => String(r._id) }),
    authorName: t.exposeString("authorName"),
    rating: t.exposeInt("rating"),
    comment: t.string({ resolve: (r) => r.comment ?? "" }),
    createdAt: t.field({ type: "DateTime", resolve: (r) => (r as any).createdAt }),
  }),
});

export const ExpertLedgerRef = builder.objectRef<ExpertLedgerDoc>("ExpertLedgerEntry").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (l) => String(l._id) }),
    type: t.field({ type: LedgerTypeEnum, resolve: (l) => l.type as never }),
    amount: t.exposeFloat("amount"),
    balanceAfter: t.exposeFloat("balanceAfter"),
    note: t.string({ resolve: (l) => l.note ?? "" }),
    createdAt: t.field({ type: "DateTime", resolve: (l) => (l as any).createdAt }),
  }),
});

export const ExpertPayoutRef = builder.objectRef<ExpertPayoutDoc>("ExpertPayout").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (p) => String(p._id) }),
    payoutNo: t.exposeString("payoutNo"),
    amount: t.exposeFloat("amount"),
    status: t.field({ type: PayoutStatusEnum, resolve: (p) => p.status as never }),
    method: t.exposeString("method"),
    destination: t.exposeString("destination"),
    reference: t.string({ resolve: (p) => p.reference ?? "" }),
    adminNote: t.string({ resolve: (p) => p.adminNote ?? "" }),
    createdAt: t.field({ type: "DateTime", resolve: (p) => (p as any).createdAt }),
    processedAt: t.field({ type: "DateTime", nullable: true, resolve: (p) => p.processedAt ?? null }),
  }),
});

export const MarketplaceSettingsRef = builder
  .objectRef<Pick<MarketplaceSettings, "commissionPct" | "minPayout">>("MarketplaceSettings")
  .implement({
    fields: (t) => ({
      commissionPct: t.exposeFloat("commissionPct"),
      minPayout: t.exposeFloat("minPayout"),
    }),
  });
