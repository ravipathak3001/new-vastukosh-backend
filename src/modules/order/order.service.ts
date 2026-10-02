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
import { reserveStock, restockItems } from "../catalog/catalog.service.js";
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

/**
 * Allowed forward transitions. Anything else throws.
 *
 * `refunded` is reachable from every post-payment status, including
 * `cancelled` — a paid order can still be cancelled before it ships (e.g.
 * consecration or packing), and that capture needs a way back regardless of
 * which stage it was cancelled at. It's deliberately absent from
 * `pending_payment` (nothing was captured yet) and reachable only through
 * `refundOrder` — never the generic `advanceOrderStatus` — since that's the
 * only path that actually calls the payment gateway (see order.schema.ts).
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["consecration", "cancelled", "refunded"],
  consecration: ["packed", "cancelled", "refunded"],
  packed: ["in_transit", "cancelled", "refunded"],
  in_transit: ["delivered", "cancelled", "refunded"],
  delivered: ["refunded"],
  cancelled: ["refunded"],
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
  const from = order.status;
  if (!canTransition(from, to)) {
    throw badInput(`Cannot move an order from ${from} to ${to}`);
  }
  order.status = to;
  order.timeline.push({ status: to, at: new Date(), note });
  await order.save();
  // A cancel always restocks. A refund restocks too, unless the order was
  // already `cancelled` (and so already restocked) before being refunded.
  if (to === "cancelled" || (to === "refunded" && from !== "cancelled")) {
    await restockItems(order.items.map((i) => ({ productSlug: i.productSlug, qty: i.qty })));
  }
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
  await reserveStock(lines.map((l) => ({ productSlug: l.productSlug, qty: l.qty })));
  const totals = await computeTotals(lines, cart.promoCode || null);

  const provider = getPaymentProvider();
  const stockLines = lines.map((l) => ({ productSlug: l.productSlug, qty: l.qty }));

  const isCod = input.paymentMethod === "cod";
  let order: OrderDoc;
  // COD never touches the gateway at all — no intent to create, nothing to
  // pay online. Calling `createIntent` anyway would open a real (and
  // pointless) Razorpay order for every COD purchase, and worse, make COD
  // checkout depend on the gateway's API being up.
  let intent: Awaited<ReturnType<typeof provider.createIntent>> | null = null;
  try {
    order = await OrderModel.create({
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
    if (!isCod) {
      intent = await provider.createIntent(order);
      order.payment.providerRef = intent.ref;
    }
  } catch (err) {
    // Order creation or payment-intent setup failed after stock was reserved — give it back.
    await restockItems(stockLines);
    throw err;
  }

  // Mock provider and Cash-on-Delivery are settled immediately.
  if (isCod || intent?.autoConfirm) {
    order.payment.status = isCod ? "created" : "captured";
    await order.save();
    await advanceStatus(order, "paid", "Payment confirmed");
    await advanceStatus(order, "consecration", "Prana Pratishtha begins");
    await clearCart(owner);
    logger.info({ orderNo: order.orderNo }, "Order placed & auto-confirmed");
  } else {
    await order.save();
  }

  return { order, clientData: intent?.clientData ?? {} };
}

/**
 * Atomically flips a `pending_payment` order straight to `consecration`
 * (paid orders always chain into consecration immediately — there's no
 * business process that pauses on `paid` alone) and records both timeline
 * entries in one write.
 *
 * This has to be a single `findOneAndUpdate` guarded by `status:
 * "pending_payment"` in the filter, not a load-mutate-save, because the
 * webhook and the client's own Checkout success callback both confirm the
 * same payment independently and can arrive within moments of each other in
 * live traffic. A load-then-save here would let the loser of that race
 * either throw or silently overwrite the winner's write. With an atomic
 * filtered update, whichever request arrives first flips the order and the
 * other's update simply matches zero documents — a clean, safe no-op.
 */
async function confirmOrderPaid(
  filter: FilterQuery<Order>,
  transactionId: string,
  note: string,
): Promise<OrderDoc | null> {
  const at = new Date();
  return OrderModel.findOneAndUpdate(
    { ...filter, status: "pending_payment" },
    {
      $set: {
        status: "consecration",
        "payment.status": "captured",
        "payment.transactionId": transactionId,
      },
      $push: {
        timeline: {
          $each: [
            { status: "paid", at, note },
            { status: "consecration", at, note: "Prana Pratishtha begins" },
          ],
        },
      },
    },
    { new: true },
  );
}

export async function markOrderPaid(providerRef: string, transactionId = ""): Promise<void> {
  const updated = await confirmOrderPaid(
    { "payment.providerRef": providerRef },
    transactionId,
    "Payment confirmed via webhook",
  );
  if (updated) {
    // Guest (anonId) carts aren't linked from the order, so only logged-in
    // carts can be cleared here — the client-side verify path clears the
    // rest via its own owner context.
    if (updated.userId) await clearCart({ userId: String(updated.userId) });
    return;
  }
  const exists = await OrderModel.exists({ "payment.providerRef": providerRef });
  if (!exists) logger.warn({ providerRef }, "Webhook for unknown order");
  // Otherwise the order was already confirmed (most likely by the client's
  // own verify call winning the race) or is in a non-payable state —
  // nothing left to do.
}

/** Flags a failed charge for admin visibility. Leaves the order at `pending_payment` so the customer can retry rather than losing the order outright — Razorpay's own Checkout modal lets a shopper retry a different instrument after a decline within the same order, so `failed` here isn't terminal. */
export async function markOrderFailed(providerRef: string): Promise<void> {
  await OrderModel.updateOne(
    { "payment.providerRef": providerRef, status: "pending_payment" },
    { $set: { "payment.status": "failed" } },
  );
}

/**
 * Confirms payment from the client's Checkout success callback, so the
 * shopper sees a confirmed order immediately instead of waiting on the
 * webhook (which can lag by several seconds, or never arrive in a broken
 * local-dev setup without a public URL).
 */
export async function verifyRazorpayPayment(
  owner: CartOwner,
  orderNo: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  if (owner.userId && String(order.userId) !== owner.userId) throw forbidden();
  if (order.payment.providerRef !== razorpayOrderId) {
    throw badInput("Payment does not match this order");
  }

  if (order.status === "pending_payment") {
    const provider = getPaymentProvider();
    if (!provider.verifyCheckoutSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      throw badInput("Payment verification failed");
    }
    const updated = await confirmOrderPaid({ orderNo }, razorpayPaymentId, "Payment confirmed by client");
    if (updated) {
      await clearCart(owner);
      return updated;
    }
    // The webhook won the race between our read above and this write —
    // fall through and return the (already-paid) current state below.
  }
  return (await OrderModel.findOne({ orderNo }))!;
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

/**
 * Refunds an order — in full by default, or partially via `amount` — and
 * moves it to `refunded`. Real money only moves when there's a captured
 * gateway payment to refund (`payment.transactionId` set); a COD order, or
 * one that was never actually charged, just closes out its status.
 *
 * The gateway call is guarded by an atomic "claim" write on
 * `payment.refundStatus` (mirroring `confirmOrderPaid`'s pattern) so a
 * double-click, or a retried request, can't fire the Razorpay refund call
 * twice for the same order.
 */
export async function refundOrder(
  orderNo: string,
  note = "",
  amount?: number | null,
): Promise<OrderDoc> {
  const order = await OrderModel.findOne({ orderNo });
  if (!order) throw notFound("Order");
  if (!canTransition(order.status, "refunded")) {
    throw badInput(`Cannot refund an order in status ${order.status}`);
  }

  if (!order.payment.transactionId) {
    // Nothing was ever captured through the gateway (COD, or a payment that
    // never completed) — there's no money to send back.
    return advanceStatus(order, "refunded", note || "Refunded by admin");
  }

  const refundAmount = amount ?? order.total;
  if (refundAmount <= 0 || refundAmount > order.total) {
    throw badInput("Refund amount must be greater than 0 and at most the order total");
  }

  const claimed = await OrderModel.findOneAndUpdate(
    { orderNo, "payment.refundStatus": { $in: ["", "failed"] } },
    { $set: { "payment.refundStatus": "pending" } },
    { new: true },
  );
  if (!claimed) throw badInput("A refund for this order is already in progress or complete");

  try {
    const result = await getPaymentProvider().refund(
      claimed.payment.transactionId,
      Math.round(refundAmount * 100),
      { orderNo },
    );
    claimed.payment.refundId = result.refundId;
    claimed.payment.refundStatus = result.status;
    claimed.payment.refundAmount = refundAmount;
    await claimed.save();
    return advanceStatus(claimed, "refunded", note || `Refunded ₹${refundAmount}`);
  } catch (err) {
    claimed.payment.refundStatus = "failed";
    await claimed.save();
    throw err;
  }
}

/** Webhook-driven update once the gateway finishes settling a refund it previously accepted (see `refundOrder`). Returns whether an order actually matched. */
export async function syncOrderRefundStatus(
  refundId: string,
  status: "processed" | "failed",
): Promise<boolean> {
  const res = await OrderModel.updateOne(
    { "payment.refundId": refundId },
    { $set: { "payment.refundStatus": status } },
  );
  return res.matchedCount > 0;
}
