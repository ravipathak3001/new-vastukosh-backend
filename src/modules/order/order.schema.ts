import { builder } from "../../graphql/builder.js";
import { LocalizedStringRef } from "../../graphql/common.js";
import { unauthenticated } from "../../shared/errors.js";
import type { Context } from "../../graphql/context.js";
import { AddressRef } from "../user/user.schema.js";
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  OrderModel,
  type OrderDoc,
} from "./order.model.js";
import {
  advanceStatus,
  allowedNextStatuses,
  cancelOrder,
  getOrder,
  listMyOrders,
  placeOrder,
  type PlaceOrderInput,
} from "./order.service.js";

export const OrderStatusEnum = builder.enumType("OrderStatus", {
  values: ORDER_STATUSES,
});
const PaymentMethodEnum = builder.enumType("PaymentMethod", { values: PAYMENT_METHODS });

const OrderItemRef = builder.objectRef<OrderDoc["items"][number]>("OrderItem").implement({
  fields: (t) => ({
    productSlug: t.exposeString("productSlug"),
    name: t.field({ type: LocalizedStringRef, resolve: (i) => i.name }),
    image: t.exposeString("image"),
    unitPrice: t.exposeFloat("unitPrice"),
    qty: t.exposeInt("qty"),
    lineTotal: t.exposeFloat("lineTotal"),
  }),
});

const OrderTimelineRef = builder
  .objectRef<OrderDoc["timeline"][number]>("OrderTimelineEntry")
  .implement({
    fields: (t) => ({
      status: t.field({ type: OrderStatusEnum, resolve: (e) => e.status as never }),
      at: t.field({ type: "DateTime", resolve: (e) => e.at }),
      note: t.exposeString("note"),
    }),
  });

const OrderPaymentRef = builder.objectRef<OrderDoc["payment"]>("OrderPayment").implement({
  fields: (t) => ({
    provider: t.exposeString("provider"),
    method: t.field({ type: PaymentMethodEnum, resolve: (p) => p.method as never }),
    status: t.exposeString("status"),
    providerRef: t.exposeString("providerRef"),
  }),
});

export const OrderRef = builder.objectRef<OrderDoc>("Order").implement({
  fields: (t) => ({
    id: t.field({ type: "ID", resolve: (o) => String(o._id) }),
    orderNo: t.exposeString("orderNo"),
    email: t.exposeString("email"),
    items: t.field({ type: [OrderItemRef], resolve: (o) => o.items }),
    subtotal: t.exposeFloat("subtotal"),
    discount: t.exposeFloat("discount"),
    shippingFee: t.exposeFloat("shippingFee"),
    total: t.exposeFloat("total"),
    currency: t.exposeString("currency"),
    promoCode: t.exposeString("promoCode", { nullable: true }),
    status: t.field({ type: OrderStatusEnum, resolve: (o) => o.status as never }),
    shippingAddress: t.field({ type: AddressRef, resolve: (o) => o.shippingAddress as never }),
    payment: t.field({ type: OrderPaymentRef, resolve: (o) => o.payment }),
    timeline: t.field({ type: [OrderTimelineRef], resolve: (o) => o.timeline }),
    createdAt: t.field({ type: "DateTime", resolve: (o) => (o as any).createdAt }),
    updatedAt: t.field({
      type: "DateTime",
      authScopes: { admin: true },
      resolve: (o) => (o as any).updatedAt,
    }),
    userId: t.field({
      type: "ID",
      nullable: true,
      authScopes: { admin: true },
      resolve: (o) => (o.userId ? String(o.userId) : null),
    }),
    /** Statuses this order may move to next (admin status stepper). */
    allowedTransitions: t.field({
      type: [OrderStatusEnum],
      authScopes: { admin: true },
      resolve: (o) => allowedNextStatuses(o.status) as never[],
    }),
  }),
});

const PlaceOrderResultRef = builder
  .objectRef<{ order: OrderDoc; clientData: Record<string, unknown> }>("PlaceOrderResult")
  .implement({
    fields: (t) => ({
      order: t.field({ type: OrderRef, resolve: (r) => r.order }),
      /** Provider-specific payload a payment SDK needs to complete the charge. */
      clientData: t.field({ type: "JSON", resolve: (r) => r.clientData }),
    }),
  });

const ShippingAddressInput = builder.inputType("ShippingAddressInput", {
  fields: (t) => ({
    firstName: t.string({ required: true }),
    lastName: t.string({ required: false }),
    line1: t.string({ required: true }),
    line2: t.string({ required: false }),
    city: t.string({ required: true }),
    state: t.string({ required: true }),
    pincode: t.string({ required: true }),
    phone: t.string({ required: false }),
  }),
});

const PlaceOrderInputRef = builder.inputType("PlaceOrderInput", {
  fields: (t) => ({
    email: t.string({ required: true }),
    paymentMethod: t.field({ type: PaymentMethodEnum, required: true }),
    shippingAddress: t.field({ type: ShippingAddressInput, required: true }),
    anonId: t.string({ required: false }),
  }),
});

function ownerFrom(ctx: Context, anonId?: string | null) {
  if (ctx.user) return { userId: ctx.user.id };
  if (anonId) return { anonId };
  return {};
}

export function registerOrderModule() {
  builder.queryFields((t) => ({
    myOrders: t.field({
      type: [OrderRef],
      authScopes: { loggedIn: true },
      resolve: (_p, _a, ctx) => listMyOrders(ctx.user!.id),
    }),
    order: t.field({
      type: OrderRef,
      nullable: true,
      args: { orderNo: t.arg.string({ required: true }) },
      resolve: (_p, { orderNo }, ctx) =>
        getOrder(orderNo, ctx.user?.id).catch(() => null),
    }),
  }));

  builder.mutationFields((t) => ({
    placeOrder: t.field({
      type: PlaceOrderResultRef,
      args: { input: t.arg({ type: PlaceOrderInputRef, required: true }) },
      resolve: (_p, { input }, ctx) => {
        const owner = ownerFrom(ctx, input.anonId);
        const payload: PlaceOrderInput = {
          email: input.email,
          paymentMethod: input.paymentMethod as PlaceOrderInput["paymentMethod"],
          shippingAddress: {
            firstName: input.shippingAddress.firstName,
            lastName: input.shippingAddress.lastName ?? undefined,
            line1: input.shippingAddress.line1,
            line2: input.shippingAddress.line2 ?? undefined,
            city: input.shippingAddress.city,
            state: input.shippingAddress.state,
            pincode: input.shippingAddress.pincode,
            phone: input.shippingAddress.phone ?? undefined,
          },
        };
        return placeOrder(owner, payload);
      },
    }),

    cancelOrder: t.field({
      type: OrderRef,
      args: {
        orderNo: t.arg.string({ required: true }),
        anonId: t.arg.string({ required: false }),
      },
      resolve: (_p, { orderNo, anonId }, ctx) =>
        cancelOrder(ownerFrom(ctx, anonId), orderNo),
    }),

    advanceOrderStatus: t.field({
      type: OrderRef,
      authScopes: { admin: true },
      args: {
        orderNo: t.arg.string({ required: true }),
        status: t.arg({ type: OrderStatusEnum, required: true }),
        note: t.arg.string({ required: false }),
      },
      resolve: async (_p, { orderNo, status, note }) => {
        const order = await OrderModel.findOne({ orderNo });
        if (!order) throw unauthenticated("Order not found");
        return advanceStatus(order, status as never, note ?? "");
      },
    }),
  }));
}
