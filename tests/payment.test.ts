import crypto from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, startTestDb, stopTestDb } from "./helpers.js";
import { env } from "../src/config/env.js";
import { OrderModel } from "../src/modules/order/order.model.js";
import { markOrderFailed, markOrderPaid } from "../src/modules/order/order.service.js";
import { RazorpayPaymentProvider } from "../src/modules/payment/payment.provider.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

function seedPendingOrder(providerRef: string) {
  return OrderModel.create({
    orderNo: "VV-000-Om",
    email: "buyer@test.com",
    items: [
      {
        productSlug: "test-item",
        name: { en: "Test Item", hi: "परीक्षण" },
        unitPrice: 1000,
        qty: 1,
        lineTotal: 1000,
      },
    ],
    subtotal: 1000,
    total: 1000,
    shippingAddress: {
      firstName: "A",
      line1: "1 Test St",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    },
    status: "pending_payment",
    payment: { provider: "razorpay", providerRef, method: "online", status: "created" },
    timeline: [{ status: "pending_payment", at: new Date(), note: "Order created" }],
  });
}

// Regression coverage for a real production incident: Razorpay's Checkout
// modal lets a shopper retry a different instrument after a decline against
// the *same* order_id, and Razorpay also retries webhook delivery on its
// own. Both mean `markOrderPaid`/`verifyRazorpayPayment` can be invoked more
// than once, or concurrently with each other, for the same order — the
// underlying `confirmOrderPaid` atomic update is what has to make that safe.
describe("payment confirmation races", () => {
  it("is idempotent under duplicate/concurrent webhook delivery", async () => {
    await seedPendingOrder("order_test123");

    await Promise.all([
      markOrderPaid("order_test123", "pay_abc"),
      markOrderPaid("order_test123", "pay_abc"),
    ]);

    const order = await OrderModel.findOne({ orderNo: "VV-000-Om" });
    expect(order).toBeTruthy();
    expect(order!.status).toBe("consecration");
    expect(order!.payment.status).toBe("captured");
    expect(order!.payment.transactionId).toBe("pay_abc");
    expect(order!.timeline.filter((t) => t.status === "paid")).toHaveLength(1);
    expect(order!.timeline.filter((t) => t.status === "consecration")).toHaveLength(1);
  });

  it("a declined attempt does not block a later successful capture on the same order", async () => {
    await seedPendingOrder("order_test123");

    await markOrderFailed("order_test123");
    let order = await OrderModel.findOne({ orderNo: "VV-000-Om" });
    expect(order!.status).toBe("pending_payment");
    expect(order!.payment.status).toBe("failed");

    await markOrderPaid("order_test123", "pay_retry");
    order = await OrderModel.findOne({ orderNo: "VV-000-Om" });
    expect(order!.status).toBe("consecration");
    expect(order!.payment.status).toBe("captured");
    expect(order!.payment.transactionId).toBe("pay_retry");
  });

  it("does nothing for an unknown providerRef instead of throwing", async () => {
    await expect(markOrderPaid("order_does_not_exist", "pay_x")).resolves.toBeUndefined();
  });
});

describe("RazorpayPaymentProvider.verifyCheckoutSignature", () => {
  const provider = new RazorpayPaymentProvider();
  const originalSecret = env.RAZORPAY_KEY_SECRET;
  const secret = "test_key_secret";

  beforeAll(() => {
    (env as { RAZORPAY_KEY_SECRET?: string }).RAZORPAY_KEY_SECRET = secret;
  });
  afterAll(() => {
    (env as { RAZORPAY_KEY_SECRET?: string }).RAZORPAY_KEY_SECRET = originalSecret;
  });

  const sign = (orderId: string, paymentId: string) =>
    crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

  it("accepts a signature genuinely produced with the key secret", () => {
    const signature = sign("order_abc", "pay_xyz");
    expect(provider.verifyCheckoutSignature("order_abc", "pay_xyz", signature)).toBe(true);
  });

  it("rejects a forged or malformed signature", () => {
    expect(provider.verifyCheckoutSignature("order_abc", "pay_xyz", "not-a-real-signature")).toBe(false);
  });

  it("rejects a genuine signature replayed against a different payment id", () => {
    const signature = sign("order_abc", "pay_xyz");
    expect(provider.verifyCheckoutSignature("order_abc", "pay_DIFFERENT", signature)).toBe(false);
  });
});

describe("RazorpayPaymentProvider.refund", () => {
  const provider = new RazorpayPaymentProvider();
  const originalId = env.RAZORPAY_KEY_ID;
  const originalSecret = env.RAZORPAY_KEY_SECRET;

  beforeAll(() => {
    (env as { RAZORPAY_KEY_ID?: string }).RAZORPAY_KEY_ID = "test_key_id";
    (env as { RAZORPAY_KEY_SECRET?: string }).RAZORPAY_KEY_SECRET = "test_key_secret";
  });
  afterAll(() => {
    (env as { RAZORPAY_KEY_ID?: string }).RAZORPAY_KEY_ID = originalId;
    (env as { RAZORPAY_KEY_SECRET?: string }).RAZORPAY_KEY_SECRET = originalSecret;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the Refunds API with the amount in paise and Basic auth, omitting amount for a full refund", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ id: "rfnd_abc", status: "processed" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.refund("pay_xyz", null, { orderNo: "VV-100-Om" });

    expect(result).toEqual({ refundId: "rfnd_abc", status: "processed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.razorpay.com/v1/payments/pay_xyz/refund");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("test_key_id:test_key_secret").toString("base64")}`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.amount).toBeUndefined();
    expect(body.notes).toEqual({ orderNo: "VV-100-Om" });
  });

  it("sends a partial amount in paise when given one", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ id: "rfnd_partial", status: "pending" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.refund("pay_xyz", 50000);

    expect(result).toEqual({ refundId: "rfnd_partial", status: "pending" });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string).amount).toBe(50000);
  });

  it("throws when the gateway rejects the refund", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { description: "nope" } }), { status: 400 })),
    );
    await expect(provider.refund("pay_xyz", null)).rejects.toThrow(/Razorpay refund failed/);
  });
});
