import type { FilterQuery } from "mongoose";
import { customAlphabet } from "nanoid";
import { badInput, forbidden, notFound } from "../../shared/errors.js";
import { searchRegex } from "../../graphql/admin-common.js";
import { logger } from "../../config/logger.js";
import {
  clearCart,
  computeTotals,
  resolveCartLines,
  type CartOwner,
} from "../cart/cart.service.js";
import { CartModel } from "../cart/cart.model.js";
import { getPaymentProvider } from "../payment/payment.provider.js";
import {
  OrderModel,
  type Order,
  type OrderDoc,
  type OrderStatus,
  type PaymentMethod,
} from "./order.model.js";

const orderDigits = customAlphabet("0123456789", 3);

/** `VV-207-Om` — mirrors the ids the frontend account pages already display. */
function generateOrderNo(): string {
  return `VV-${orderDigits()}-Om`;
}

/** Allowed forward transitions. Anything else throws. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["consecration", "cancelled", "refunded"],
  consecration: ["packed", "cancelled"],
  packed: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** The statuses an order in `from` may move to next — drives the admin UI. */
export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[from]];
}

export async function advanceStatus(
  order: OrderDoc,
  to: OrderStatus,
  note = "",
): Promise<OrderDoc> {
  if (!canTransition(order.status, to)) {
    throw badInput(`Cannot move an order from ${order.status} to ${to}`);
  }
  order.status = to;
  order.timeline.push({ status: to, at: new Date(), note });
  await order.save();
  return order;
}

export type PlaceOrderInput = {
  email: string;
  shippingAddress: {
    firstName: string;
    lastName?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    phone?: string;
  };
  paymentMethod: PaymentMethod;
};

export async function placeOrder(
  owner: CartOwner,
  input: PlaceOrderInput,
): Promise<{ order: OrderDoc; clientData: Record<string, unknown> }> {
  const cartQuery = owner.userId ? { userId: owner.userId } : { anonId: owner.anonId };
  const cart = await CartModel.findOne(cartQuery);
  if (!cart || cart.items.length === 0) throw badInput("Your cart is empty");

  const lines = await resolveCartLines(cart.items);
  if (lines.length === 0) throw badInput("None of the items in your cart are available");
  const totals = await computeTotals(lines, cart.promoCode || null);

  const provider = getPaymentProvider();

  const order = await OrderModel.create({
    orderNo: generateOrderNo(),
    userId: owner.userId ?? null,
    email: input.email.toLowerCase().trim(),
    items: lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    shippingFee: totals.shipping,
    total: totals.total,
    promoCode: totals.promoCode ?? "",
    shippingAddress: {
      firstName: input.shippingAddress.firstName,
      lastName: input.shippingAddress.lastName ?? "",
      line1: input.shippingAddress.line1,
      line2: input.shippingAddress.line2 ?? "",
      city: input.shippingAddress.city,
      state: input.shippingAddress.state,
      pincode: input.shippingAddress.pincode,
      phone: input.shippingAddress.phone ?? "",
    },
    status: "pending_payment",
    payment: { provider: provider.name, method: input.paymentMethod, status: "created" },
    timeline: [{ status: "pending_payment", at: new Date(), note: "Order created" }],
  });

  const intent = await provider.createIntent(order);
  order.payment.providerRef = intent.ref;

  // Mock provider and Cash-on-Delivery are settled immediately.
  if (intent.autoConfirm || input.paymentMethod === "cod") {
    order.payment.status = input.paymentMethod === "cod" ? "created" : "captured";
    await order.save();
    await advanceStatus(order, "paid", "Payment confirmed");
    await advanceStatus(order, "consecration", "Prana Pratishtha begins");
    await clearCart(owner);
    logger.info({ orderNo: order.orderNo }, "Order placed & auto-confirmed");
  } else {
    await order.save();
  }

  return { order, clientData: intent.clientData };
}

export async function markOrderPaid(providerRef: string): Promise<void> {
  const order = await OrderModel.findOne({ "payment.providerRef": providerRef });
  if (!order) {
    logger.warn({ providerRef }, "Webhook for unknown order");
    return;
  }
  if (order.status !== "pending_payment") return;
  order.payment.status = "captured";
  await order.save();
  await advanceStatus(order, "paid", "Payment confirmed via webhook");
  await advanceStatus(order, "consecration", "Prana Pratishtha begins");
}

export async function cancelOrder(owner: CartOwner, orderNo: string): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  if (owner.userId && String(order.userId) !== owner.userId) throw forbidden();
  return advanceStatus(order, "cancelled", "Cancelled by customer");
}

export async function listMyOrders(userId: string): Promise<OrderDoc[]> {
  return OrderModel.find({ userId }).sort({ createdAt: -1 });
}

export async function getOrder(orderNo: string, userId?: string): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  if (userId && order.userId && String(order.userId) !== userId) throw forbidden();
  return order;
}

// ─── Admin ──────────────────────────────────────────────────────────────

export type AdminOrderFilter = {
  status?: OrderStatus | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  /** true = verified only, false = awaiting verification, null/undefined = either. */
  verified?: boolean | null;
};

export type AdminOrderSort = "newest" | "oldest" | "total_desc" | "total_asc";

const ADMIN_ORDER_SORT: Record<AdminOrderSort, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  total_desc: { total: -1 },
  total_asc: { total: 1 },
};

export async function listOrdersForAdmin(
  filter: AdminOrderFilter,
  skip: number,
  limit: number,
  sort: AdminOrderSort = "newest",
): Promise<{ items: OrderDoc[]; total: number }> {
  const q: FilterQuery<Order> = {};
  if (filter.status) q.status = filter.status;
  if (filter.search?.trim()) {
    const rx = searchRegex(filter.search);
    q.$or = [{ orderNo: rx }, { email: rx }];
  }
  if (filter.dateFrom || filter.dateTo) {
    const range: Record<string, Date> = {};
    if (filter.dateFrom) range.$gte = new Date(filter.dateFrom);
    if (filter.dateTo) range.$lte = new Date(`${filter.dateTo}T23:59:59.999Z`);
    q.createdAt = range;
  }
  if (filter.verified != null) {
    q.verifiedAt = filter.verified ? { $ne: null } : null;
  }
  const [items, total] = await Promise.all([
    OrderModel.find(q).sort(ADMIN_ORDER_SORT[sort]).skip(skip).limit(limit),
    OrderModel.countDocuments(q),
  ]);
  return { items, total };
}

/** Move an order to `refunded` (valid from `paid` or `delivered`). */
export async function refundOrder(orderNo: string, note = ""): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  return advanceStatus(order, "refunded", note || "Refunded by admin");
}
