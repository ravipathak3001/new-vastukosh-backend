import { builder } from "../../graphql/builder.js";
import { unauthenticated } from "../../shared/errors.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import { RETURN_STATUSES, type ReturnDoc } from "./return.model.js";
import { getOrder } from "../order/order.service.js";
import {
  cancelReturn,
  getReturn,
  getReturnEligibility,
  listMyReturns,
  requestReturn,
  type ReturnEligibility,
} from "./return.service.js";

export const ReturnStatusEnum = builder.enumType("ReturnStatus", { values: RETURN_STATUSES });

const ReturnItemRef = builder.objectRef<ReturnDoc["items"][number]>("ReturnItem").implement({
  fields: (t) => ({
    productSlug: t.exposeString("productSlug"),
    name: t.field({ type: LocalizedStringRef, resolve: (i) => i.name }),
    qty: t.exposeInt("qty"),
    reason: t.exposeString("reason"),
  }),
});

const ReturnTimelineRef = builder
  .objectRef<ReturnDoc["timeline"][number]>("ReturnTimelineEntry")
  .implement({
    fields: (t) => ({
      status: t.field({ type: ReturnStatusEnum, resolve: (e) => e.status as never }),
      at: t.field({ type: "DateTime", resolve: (e) => e.at }),
      note: t.exposeString("note"),
    }),
  });

const ReturnShipmentRef = builder
  .objectRef<NonNullable<ReturnDoc["shipment"]>>("ReturnShipment")
  .implement({
    fields: (t) => ({
      provider: t.exposeString("provider"),
      awbCode: t.exposeString("awbCode"),
      courierName: t.exposeString("courierName"),
      trackingUrl: t.exposeString("trackingUrl"),
      pickupScheduledDate: t.field({
        type: "DateTime",
        nullable: true,
        resolve: (s) => s.pickupScheduledDate,
      }),
      rawStatus: t.exposeString("rawStatus"),
    }),
  });

export const ReturnRef = builder.objectRef<ReturnDoc>("Return").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (r) => String(r._id) }),
    returnNo: t.exposeString("returnNo"),
    orderNo: t.exposeString("orderNo"),
    items: t.field({ type: [ReturnItemRef], resolve: (r) => r.items }),
    status: t.field({ type: ReturnStatusEnum, resolve: (r) => r.status as never }),
    refundAmount: t.exposeFloat("refundAmount"),
    adminNote: t.exposeString("adminNote", { authScopes: { permission: "returns.view" } }),
    shipment: t.field({ type: ReturnShipmentRef, nullable: true, resolve: (r) => r.shipment }),
    timeline: t.field({ type: [ReturnTimelineRef], resolve: (r) => r.timeline }),
    createdAt: t.field({ type: "DateTime", resolve: (r) => (r as any).createdAt }),
  }),
});

const EligibleItemRef = builder
  .objectRef<ReturnEligibility["items"][number]>("ReturnEligibleItem")
  .implement({
    fields: (t) => ({
      productSlug: t.exposeString("productSlug"),
      name: t.exposeString("name"),
      qty: t.exposeInt("qty"),
      maxQty: t.exposeInt("maxQty"),
    }),
  });

const ReturnEligibilityRef = builder.objectRef<ReturnEligibility>("ReturnEligibility").implement({
  fields: (t) => ({
    eligible: t.exposeBoolean("eligible"),
    reason: t.exposeString("reason"),
    deadline: t.field({ type: "DateTime", nullable: true, resolve: (e) => e.deadline }),
    items: t.field({ type: [EligibleItemRef], resolve: (e) => e.items }),
  }),
});

const ReturnItemInput = builder.inputType("ReturnItemInput", {
  fields: (t) => ({
    productSlug: t.string({ required: true }),
    qty: t.int({ required: true }),
    reason: t.string({ required: true }),
  }),
});

export function registerReturnModule() {
  builder.queryFields((t) => ({
    myReturns: t.field({
      type: [ReturnRef],
      authScopes: { loggedIn: true },
      resolve: (_p, _a, ctx) => listMyReturns(ctx.user!.id),
    }),

    myReturn: t.field({
      type: ReturnRef,
      nullable: true,
      authScopes: { loggedIn: true },
      args: { returnNo: t.arg.string({ required: true }) },
      resolve: (_p, { returnNo }, ctx) => getReturn(returnNo, ctx.user!.id).catch(() => null),
    }),

    returnEligibility: t.field({
      type: ReturnEligibilityRef,
      authScopes: { loggedIn: true },
      args: { orderNo: t.arg.string({ required: true }) },
      resolve: async (_p, { orderNo }, ctx) => {
        const order = await getOrder(orderNo, ctx.user!.id);
        return getReturnEligibility(order);
      },
    }),
  }));

  builder.mutationFields((t) => ({
    requestReturn: t.field({
      type: ReturnRef,
      authScopes: { loggedIn: true },
      args: {
        orderNo: t.arg.string({ required: true }),
        items: t.arg({ type: [ReturnItemInput], required: true }),
      },
      resolve: (_p, { orderNo, items }, ctx) =>
        requestReturn({ orderNo, userId: ctx.user!.id, items: items.map((i) => ({ ...i })) }),
    }),

    cancelReturn: t.field({
      type: ReturnRef,
      authScopes: { loggedIn: true },
      args: { returnNo: t.arg.string({ required: true }) },
      resolve: (_p, { returnNo }, ctx) => {
        if (!ctx.user) throw unauthenticated();
        return cancelReturn(returnNo, ctx.user.id);
      },
    }),
  }));
}
