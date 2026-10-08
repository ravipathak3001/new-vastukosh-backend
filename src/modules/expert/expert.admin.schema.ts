import { builder } from "../../graphql/builder.js";
import { ConsultationBookingRef } from "../consultation/consultation.schema.js";
import { assignBookingExpert } from "../consultation/consultation.service.js";
import {
  ExpertLedgerRef,
  ExpertPayoutRef,
  ExpertProfileRef,
  ExpertReviewRef,
  ExpertStatusEnum,
  MarketplaceSettingsRef,
  PayoutStatusEnum,
} from "./expert.refs.js";
import { ExpertProfileModel, ExpertReviewModel, type ExpertPayoutDoc } from "./expert.model.js";
import {
  adjustExpertWallet,
  getExpertForAdmin,
  getMarketplaceSettings,
  listExpertsForAdmin,
  listLedger,
  listPayouts,
  listPayoutsForAdmin,
  markPayoutPaid,
  rejectPayout,
  setExpertCommission,
  setExpertStatus,
  setReviewHidden,
  updateMarketplaceSettings,
} from "./expert.service.js";

/** Admin payout row with the expert attached (the payout list spans all experts). */
const AdminPayoutRef = builder.objectRef<ExpertPayoutDoc>("AdminExpertPayout").implement({
  fields: (t) => ({
    payout: t.field({ type: ExpertPayoutRef, resolve: (p) => p }),
    expert: t.field({
      type: ExpertProfileRef,
      nullable: true,
      resolve: (p) => ExpertProfileModel.findById(p.expertId).exec(),
    }),
  }),
});

export function registerExpertAdminModule() {
  builder.queryFields((t) => ({
    adminExperts: t.field({
      type: [ExpertProfileRef],
      authScopes: { permission: "experts.view" },
      args: {
        status: t.arg({ type: ExpertStatusEnum, required: false }),
        search: t.arg.string({ required: false }),
      },
      resolve: (_p, { status, search }) =>
        listExpertsForAdmin({ status: (status ?? null) as never, search: search ?? null }),
    }),
    adminExpert: t.field({
      type: ExpertProfileRef,
      nullable: true,
      authScopes: { permission: "experts.view" },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_p, { id }) => getExpertForAdmin(String(id)).catch(() => null),
    }),
    adminExpertLedger: t.field({
      type: [ExpertLedgerRef],
      authScopes: { permission: "experts.view" },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_p, { id }) => listLedger(String(id), 200),
    }),
    adminExpertPayoutsFor: t.field({
      type: [ExpertPayoutRef],
      authScopes: { permission: "experts.view" },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_p, { id }) => listPayouts(String(id)),
    }),
    adminExpertReviews: t.field({
      type: [ExpertReviewRef],
      authScopes: { permission: "experts.view" },
      args: { id: t.arg.id({ required: true }) },
      resolve: (_p, { id }) =>
        ExpertReviewModel.find({ expertId: String(id) }).sort({ _id: -1 }).limit(200).exec(),
    }),
    adminPayouts: t.field({
      type: [AdminPayoutRef],
      authScopes: { permission: "payouts.manage" },
      args: { status: t.arg({ type: PayoutStatusEnum, required: false }) },
      resolve: (_p, { status }) => listPayoutsForAdmin(status ?? null),
    }),
    marketplaceSettings: t.field({
      type: MarketplaceSettingsRef,
      authScopes: { permission: "experts.view" },
      resolve: () => getMarketplaceSettings(),
    }),
  }));

  builder.mutationFields((t) => ({
    /** Approve / reject / suspend an expert. Rejections and suspensions need a note (shown to the expert). */
    setExpertStatus: t.field({
      type: ExpertProfileRef,
      authScopes: { permission: "experts.manage" },
      args: {
        id: t.arg.id({ required: true }),
        status: t.arg({ type: ExpertStatusEnum, required: true }),
        note: t.arg.string({ required: false }),
      },
      resolve: (_p, { id, status, note }) => setExpertStatus(String(id), status as never, note ?? ""),
    }),
    /** Per-expert commission override (%); null reverts to the marketplace default. */
    setExpertCommission: t.field({
      type: ExpertProfileRef,
      authScopes: { permission: "experts.manage" },
      args: { id: t.arg.id({ required: true }), commissionPct: t.arg.float({ required: false }) },
      resolve: (_p, { id, commissionPct }) => setExpertCommission(String(id), commissionPct ?? null),
    }),
    adjustExpertWallet: t.field({
      type: ExpertProfileRef,
      authScopes: { permission: "payouts.manage" },
      args: {
        id: t.arg.id({ required: true }),
        amount: t.arg.float({ required: true }),
        note: t.arg.string({ required: true }),
      },
      resolve: (_p, { id, amount, note }) => adjustExpertWallet(String(id), amount, note),
    }),
    /** Record a cashout as paid with the bank / UPI transaction reference. */
    markPayoutPaid: t.field({
      type: ExpertPayoutRef,
      authScopes: { permission: "payouts.manage" },
      args: {
        id: t.arg.id({ required: true }),
        reference: t.arg.string({ required: true }),
        note: t.arg.string({ required: false }),
      },
      resolve: (_p, { id, reference, note }, ctx) =>
        markPayoutPaid(String(id), reference, ctx.user!.id, note ?? ""),
    }),
    /** Reject a cashout; the held amount returns to the expert's wallet. */
    rejectPayout: t.field({
      type: ExpertPayoutRef,
      authScopes: { permission: "payouts.manage" },
      args: { id: t.arg.id({ required: true }), note: t.arg.string({ required: true }) },
      resolve: (_p, { id, note }, ctx) => rejectPayout(String(id), note, ctx.user!.id),
    }),
    updateMarketplaceSettings: t.field({
      type: MarketplaceSettingsRef,
      authScopes: { permission: "experts.manage" },
      args: {
        commissionPct: t.arg.float({ required: false }),
        minPayout: t.arg.float({ required: false }),
      },
      resolve: (_p, args) => updateMarketplaceSettings(args),
    }),
    /** Give a platform booking (no expert yet) to an approved expert. */
    assignBookingExpert: t.field({
      type: ConsultationBookingRef,
      authScopes: { permission: "bookings.manage" },
      args: { id: t.arg.id({ required: true }), expertId: t.arg.id({ required: true }) },
      resolve: (_p, { id, expertId }) => assignBookingExpert(String(id), String(expertId)),
    }),
    setExpertReviewHidden: t.field({
      type: ExpertReviewRef,
      authScopes: { permission: "experts.manage" },
      args: { id: t.arg.id({ required: true }), hidden: t.arg.boolean({ required: true }) },
      resolve: (_p, { id, hidden }) => setReviewHidden(String(id), hidden),
    }),
  }));
}
