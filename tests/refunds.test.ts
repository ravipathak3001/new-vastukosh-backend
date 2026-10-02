import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, startTestDb, stopTestDb } from "./helpers.js";
import { ProductModel } from "../src/modules/catalog/product.model.js";
import { OrderModel, type OrderStatus } from "../src/modules/order/order.model.js";
import { refundOrder, syncOrderRefundStatus } from "../src/modules/order/order.service.js";
import { ReturnModel, type ReturnStatus } from "../src/modules/returns/return.model.js";
import { refundReturn, syncReturnRefundStatus } from "../src/modules/returns/return.service.js";

const PRODUCT_SLUG = "test-ganesha";
const STARTING_STOCK = 5;

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await resetDb();
  await ProductModel.create({
    slug: PRODUCT_SLUG,
    name: { en: "Test Ganesha", hi: "परीक्षण गणेश" },
    tagline: { en: "t", hi: "t" },
    description: { en: "d", hi: "d" },
    price: 1000,
    category: "idols",
    image: "/x.jpg",
    status: "active",
    stockQty: STARTING_STOCK,
  });
});

/** A 2-unit, ₹2000 order — captured through the (test-forced) mock provider, exactly like a real captured Razorpay payment would look once `confirmOrderPaid` has run. */
function seedOrder(status: OrderStatus, paymentOverrides: Record<string, unknown> = {}) {
  return OrderModel.create({
    orderNo: "VV-100-Om",
    email: "buyer@test.com",
    items: [
      {
        productSlug: PRODUCT_SLUG,
        name: { en: "Test Ganesha", hi: "परीक्षण गणेश" },
        unitPrice: 1000,
        qty: 2,
        lineTotal: 2000,
      },
    ],
    subtotal: 2000,
    total: 2000,
    shippingAddress: {
      firstName: "A",
      line1: "1 Test St",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    },
    status,
    payment: {
      provider: "mock",
      providerRef: "order_test1",
      transactionId: "pay_test1",
      method: "online",
      status: "captured",
      ...paymentOverrides,
    },
    timeline: [{ status: "pending_payment", at: new Date(), note: "Order created" }],
  });
}

async function stockNow(): Promise<number> {
  return (await ProductModel.findOne({ slug: PRODUCT_SLUG }))!.stockQty;
}

describe("refundOrder", () => {
  it("refunds the full amount by default, moves the order to refunded, and restocks", async () => {
    await seedOrder("paid");

    const order = await refundOrder("VV-100-Om");

    expect(order.status).toBe("refunded");
    expect(order.payment.refundStatus).toBe("processed");
    expect(order.payment.refundId).toMatch(/^mock_refund_/);
    expect(order.payment.refundAmount).toBe(2000);
    expect(await stockNow()).toBe(STARTING_STOCK + 2);
  });

  it("supports a partial refund amount", async () => {
    await seedOrder("paid");
    const order = await refundOrder("VV-100-Om", "goodwill gesture", 500);
    expect(order.status).toBe("refunded");
    expect(order.payment.refundAmount).toBe(500);
  });

  it("rejects a refund amount above the order total", async () => {
    await seedOrder("paid");
    await expect(refundOrder("VV-100-Om", "", 5000)).rejects.toThrow();
  });

  it("succeeds from consecration/packed/in_transit, not just paid/delivered", async () => {
    for (const status of ["consecration", "packed", "in_transit", "delivered"] as OrderStatus[]) {
      await resetDb();
      await ProductModel.create({
        slug: PRODUCT_SLUG,
        name: { en: "Test Ganesha", hi: "परीक्षण गणेश" },
        tagline: { en: "t", hi: "t" },
        description: { en: "d", hi: "d" },
        price: 1000,
        category: "idols",
        image: "/x.jpg",
        status: "active",
        stockQty: STARTING_STOCK,
      });
      await seedOrder(status);
      const order = await refundOrder("VV-100-Om");
      expect(order.status).toBe("refunded");
    }
  });

  it("rejects refunding an order that was never paid", async () => {
    await seedOrder("pending_payment", { status: "created", transactionId: "" });
    await expect(refundOrder("VV-100-Om")).rejects.toThrow();
  });

  it("closes out a COD order without a gateway call — no transactionId to refund", async () => {
    await seedOrder("paid", { transactionId: "", providerRef: "", method: "cod", status: "created" });
    const order = await refundOrder("VV-100-Om");
    expect(order.status).toBe("refunded");
    expect(order.payment.refundId).toBe("");
    expect(order.payment.refundStatus).toBe("");
    expect(await stockNow()).toBe(STARTING_STOCK + 2);
  });

  it("does not restock twice when refunding an order that was already cancelled", async () => {
    await seedOrder("cancelled");
    const before = await stockNow();
    await refundOrder("VV-100-Om");
    expect(await stockNow()).toBe(before);
  });

  it("rejects a second refund attempt on an already-refunded order", async () => {
    await seedOrder("paid");
    await refundOrder("VV-100-Om");
    await expect(refundOrder("VV-100-Om")).rejects.toThrow();
  });

  // The same production incident class as the payment-confirmation race
  // (see payment.test.ts) applies here: an admin double-clicking "Refund",
  // or a retried request, must not fire the gateway call twice.
  it("is safe under a concurrent double-click — only one refund is recorded", async () => {
    await seedOrder("paid");

    const results = await Promise.allSettled([refundOrder("VV-100-Om"), refundOrder("VV-100-Om")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    // Stock released exactly once, not twice.
    expect(await stockNow()).toBe(STARTING_STOCK + 2);
  });
});

describe("refundReturn", () => {
  function seedReturn(status: ReturnStatus, overrides: Record<string, unknown> = {}) {
    return ReturnModel.create({
      returnNo: "RET-100-Om",
      orderNo: "VV-100-Om",
      items: [
        { productSlug: PRODUCT_SLUG, name: { en: "Test Ganesha", hi: "परीक्षण गणेश" }, qty: 1, reason: "wrong size" },
      ],
      status,
      timeline: [{ status: "requested", at: new Date(), note: "" }],
      ...overrides,
    });
  }

  it("refunds against the order's captured payment and restocks the returned qty", async () => {
    await seedOrder("delivered");
    await seedReturn("received");

    const ret = await refundReturn("RET-100-Om", 1000);

    expect(ret.status).toBe("refunded");
    expect(ret.refundStatus).toBe("processed");
    expect(ret.refundId).toMatch(/^mock_refund_/);
    expect(ret.refundAmount).toBe(1000);
    expect(await stockNow()).toBe(STARTING_STOCK + 1);
  });

  it("closes out without a gateway call when the order was COD", async () => {
    await seedOrder("delivered", { transactionId: "", providerRef: "", method: "cod", status: "created" });
    await seedReturn("received");

    const ret = await refundReturn("RET-100-Om", 1000);
    expect(ret.status).toBe("refunded");
    expect(ret.refundId).toBe("");
  });

  it("rejects refunding a return that hasn't been received yet", async () => {
    await seedOrder("delivered");
    await seedReturn("approved");
    await expect(refundReturn("RET-100-Om", 1000)).rejects.toThrow();
  });

  it("rejects a refund amount above the order total", async () => {
    await seedOrder("delivered");
    await seedReturn("received");
    await expect(refundReturn("RET-100-Om", 50000)).rejects.toThrow();
  });
});

describe("refund webhook sync", () => {
  it("updates an order's refund status once the gateway confirms it", async () => {
    await seedOrder("paid", { refundId: "rfnd_abc", refundStatus: "pending" });
    expect(await syncOrderRefundStatus("rfnd_abc", "processed")).toBe(true);
    const order = await OrderModel.findOne({ orderNo: "VV-100-Om" });
    expect(order!.payment.refundStatus).toBe("processed");
  });

  it("is a no-op for an unknown refund id", async () => {
    expect(await syncOrderRefundStatus("rfnd_unknown", "processed")).toBe(false);
  });

  it("updates a return's refund status once the gateway confirms it", async () => {
    await ReturnModel.create({
      returnNo: "RET-100-Om",
      orderNo: "VV-100-Om",
      items: [{ productSlug: PRODUCT_SLUG, name: { en: "T", hi: "T" }, qty: 1, reason: "r" }],
      status: "received",
      refundId: "rfnd_xyz",
      refundStatus: "pending",
      timeline: [{ status: "requested", at: new Date(), note: "" }],
    });
    expect(await syncReturnRefundStatus("rfnd_xyz", "failed")).toBe(true);
    const ret = await ReturnModel.findOne({ returnNo: "RET-100-Om" });
    expect(ret!.refundStatus).toBe("failed");
  });
});
