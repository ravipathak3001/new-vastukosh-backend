import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductModel } from "../src/modules/catalog/product.model.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { OrderModel } from "../src/modules/order/order.model.js";
import {
  pollShipmentStatuses,
  syncShipmentStatus,
  updateAutomationSettings,
} from "../src/modules/shipping/shipping.service.js";
import { CarrierError, getShippingProvider } from "../src/modules/shipping/shipping.provider.js";
import { ALL_PERMISSION_KEYS } from "../src/modules/roles/permission-catalog.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();
const adminToken = signAccessToken({
  sub: "000000000000000000000001",
  roles: ["admin"],
  permissions: ALL_PERMISSION_KEYS,
});
const adminAuth = { authorization: `Bearer ${adminToken}` };

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await resetDb();
  await ProductModel.create({
    slug: "test-ganesha",
    name: { en: "Test Ganesha", hi: "परीक्षण गणेश" },
    tagline: { en: "t", hi: "t" },
    description: { en: "d", hi: "d" },
    price: 1000,
    category: "idols",
    image: "/x.jpg",
    status: "active",
    stockQty: 100,
  });
});

async function placePackedOrder(): Promise<string> {
  await gql(`mutation { addToCart(anonId: "g1", productSlug: "test-ganesha", qty: 1) { itemCount } }`);
  const placed = await gql(
    `mutation { placeOrder(input: {
      email: "a@test.com", paymentMethod: cod, anonId: "g1",
      shippingAddress: { firstName: "A", line1: "L1", city: "C", state: "S", pincode: "110001" }
    }) { order { orderNo status } } }`,
  );
  const orderNo = placed.data.placeOrder.order.orderNo as string;
  expect(placed.data.placeOrder.order.status).toBe("consecration");

  const packed = await gql(
    `mutation ($n: String!) { advanceOrderStatus(orderNo: $n, status: packed) { status } }`,
    { n: orderNo },
    adminAuth,
  );
  expect(packed.data.advanceOrderStatus.status).toBe("packed");
  return orderNo;
}

describe("verify → start delivery", () => {
  it("blocks the generic status mutation from jumping straight to in_transit", async () => {
    const orderNo = await placePackedOrder();
    const res = await gql(
      `mutation ($n: String!) { advanceOrderStatus(orderNo: $n, status: in_transit) { status } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(res.errors?.[0]?.message).toMatch(/startDelivery/i);
  });

  it("refuses to start delivery before the order is verified", async () => {
    const orderNo = await placePackedOrder();
    const res = await gql(
      `mutation ($n: String!) { startDelivery(orderNo: $n) { status } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(res.errors?.[0]?.message).toMatch(/verify/i);
  });

  it("never touches the shipping provider until startDelivery is called", async () => {
    const orderNo = await placePackedOrder();
    const before = await gql(`query ($n: String!) { adminOrder(orderNo: $n) { shipment { awbCode } } }`, {
      n: orderNo,
    }, adminAuth);
    expect(before.data.adminOrder.shipment).toBeNull();
  });

  it("creates a shipment and advances to in_transit once verified", async () => {
    const orderNo = await placePackedOrder();

    const verified = await gql(
      `mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(verified.data.verifyOrder.verifiedAt).toBeTruthy();

    const started = await gql(
      `mutation ($n: String!) {
        startDelivery(orderNo: $n) {
          status
          shipment { provider awbCode courierName trackingUrl }
          timeline { status note }
        }
      }`,
      { n: orderNo },
      adminAuth,
    );
    const order = started.data.startDelivery;
    expect(order.status).toBe("in_transit");
    expect(order.shipment.provider).toBe("mock");
    expect(order.shipment.awbCode).toBeTruthy();
    expect(order.timeline.at(-1).status).toBe("in_transit");
    expect(order.timeline.at(-1).note).toContain(order.shipment.awbCode);
  });

  it("moves an in_transit order to delivered when the carrier webhook reports delivery", async () => {
    const orderNo = await placePackedOrder();
    await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
    const started = await gql(
      `mutation ($n: String!) { startDelivery(orderNo: $n) { shipment { awbCode } } }`,
      { n: orderNo },
      adminAuth,
    );
    const awbCode = started.data.startDelivery.shipment.awbCode as string;

    await syncShipmentStatus(awbCode, "DELIVERED", true);

    const after = await gql(
      `query ($n: String!) { adminOrder(orderNo: $n) { status shipment { rawStatus statusHistory { status } } } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(after.data.adminOrder.status).toBe("delivered");
    expect(after.data.adminOrder.shipment.rawStatus).toBe("DELIVERED");
  });

  it("cancelling a shipment also cancels the order", async () => {
    const orderNo = await placePackedOrder();
    await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
    await gql(`mutation ($n: String!) { startDelivery(orderNo: $n) { status } }`, { n: orderNo }, adminAuth);

    const cancelled = await gql(
      `mutation ($n: String!) { cancelShipment(orderNo: $n, note: "customer refused delivery") { status shipment { cancelledAt } } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(cancelled.data.cancelShipment.status).toBe("cancelled");
    expect(cancelled.data.cancelShipment.shipment.cancelledAt).toBeTruthy();
  });

  it("lets the order's owner see their own shipment, but not a stranger", async () => {
    const signup = await gql(
      `mutation ($i: SignupInput!) { signup(input: $i) { accessToken } }`,
      { i: { name: "Owner", email: "owner@test.com", password: "secret123" } },
    );
    const ownerAuth = { authorization: `Bearer ${signup.data.signup.accessToken}` };

    await gql(`mutation { addToCart(productSlug: "test-ganesha", qty: 1) { itemCount } }`, undefined, ownerAuth);
    const placed = await gql(
      `mutation { placeOrder(input: {
        email: "owner@test.com", paymentMethod: cod,
        shippingAddress: { firstName: "O", line1: "L1", city: "C", state: "S", pincode: "110001" }
      }) { order { orderNo } } }`,
      undefined,
      ownerAuth,
    );
    const orderNo = placed.data.placeOrder.order.orderNo as string;
    await gql(`mutation ($n: String!) { advanceOrderStatus(orderNo: $n, status: packed) { status } }`, { n: orderNo }, adminAuth);
    await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
    await gql(`mutation ($n: String!) { startDelivery(orderNo: $n) { status } }`, { n: orderNo }, adminAuth);

    const ownerView = await gql(
      `query ($n: String!) { order(orderNo: $n) { shipment { awbCode } } }`,
      { n: orderNo },
      ownerAuth,
    );
    expect(ownerView.data.order.shipment.awbCode).toBeTruthy();

    const strangerSignup = await gql(
      `mutation ($i: SignupInput!) { signup(input: $i) { accessToken } }`,
      { i: { name: "Stranger", email: "stranger@test.com", password: "secret123" } },
    );
    const strangerAuth = { authorization: `Bearer ${strangerSignup.data.signup.accessToken}` };
    const strangerView = await gql(
      `query ($n: String!) { order(orderNo: $n) { shipment { awbCode } } }`,
      { n: orderNo },
      strangerAuth,
    );
    // getOrder() itself already hides the whole order from a non-owner (returns null).
    expect(strangerView.data.order).toBeNull();
  });
});

describe("shipping automation", () => {
  it("auto-schedules pickup after start delivery by default", async () => {
    const orderNo = await placePackedOrder();
    await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
    const started = await gql(
      `mutation ($n: String!) { startDelivery(orderNo: $n) { shipment { pickupScheduledDate } } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(started.data.startDelivery.shipment.pickupScheduledDate).toBeTruthy();
  });

  it("skips auto pickup when disabled in settings", async () => {
    const disabled = await gql(
      `mutation { updateShippingAutomationSettings(input: { autoSchedulePickup: false }) { autoSchedulePickup } }`,
      undefined,
      adminAuth,
    );
    expect(disabled.data.updateShippingAutomationSettings.autoSchedulePickup).toBe(false);

    const orderNo = await placePackedOrder();
    await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
    const started = await gql(
      `mutation ($n: String!) { startDelivery(orderNo: $n) { shipment { pickupScheduledDate } } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(started.data.startDelivery.shipment.pickupScheduledDate).toBeNull();
  });

  it("poll fallback records a status change and respects the disabled flag", async () => {
    await updateAutomationSettings({ pollEnabled: false });
    const orderNo = await placePackedOrder();
    await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
    await gql(`mutation ($n: String!) { startDelivery(orderNo: $n) { status } }`, { n: orderNo }, adminAuth);

    await pollShipmentStatuses();
    let order = await OrderModel.findOne({ orderNo });
    expect(order!.shipment!.statusHistory).toHaveLength(1); // only the initial "AWB ASSIGNED" entry — poll was a no-op

    await updateAutomationSettings({ pollEnabled: true, pollIntervalMinutes: 5 });
    await pollShipmentStatuses();
    order = await OrderModel.findOne({ orderNo });
    expect(order!.shipment!.statusHistory.length).toBeGreaterThan(1);
    expect(order!.shipment!.rawStatus).toBe("IN TRANSIT"); // MockShippingProvider.track()'s fixed response
  });
});

describe("AWB not assigned at shipment creation", () => {
  afterEach(() => vi.restoreAllMocks());

  async function startWithoutAwb(): Promise<string> {
    const provider = getShippingProvider();
    vi.spyOn(provider, "createShipment").mockImplementation(async (order) => ({
      providerOrderId: `sr_${order.orderNo}`,
      shipmentId: `ship_${order.orderNo}`,
      awbCode: "",
      courierId: "",
      courierName: "",
      trackingUrl: "",
      awbError: "Insufficient wallet balance",
    }));
    const schedule = vi.spyOn(provider, "schedulePickup");
    await updateAutomationSettings({ autoSchedulePickup: true });

    const orderNo = await placePackedOrder();
    await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
    const started = await gql(
      `mutation ($n: String!) { startDelivery(orderNo: $n) { status shipment { awbCode rawStatus trackingUrl } } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(started.data.startDelivery).toMatchObject({
      status: "in_transit",
      shipment: { awbCode: "", rawStatus: "AWB PENDING", trackingUrl: "" },
    });
    expect(schedule).not.toHaveBeenCalled(); // no pickup without an AWB
    const order = await OrderModel.findOne({ orderNo });
    expect(JSON.stringify(order!.timeline)).toContain("Insufficient wallet balance");
    return orderNo;
  }

  it("the poller picks up an AWB assigned later in the carrier dashboard", async () => {
    const orderNo = await startWithoutAwb();
    vi.spyOn(getShippingProvider(), "getShipmentAwb").mockResolvedValue({
      awbCode: "7D000000001",
      courierId: "6",
      courierName: "DTDC Surface",
      trackingUrl: "https://shiprocket.co/tracking/7D000000001",
    });
    await updateAutomationSettings({ pollEnabled: true, pollIntervalMinutes: 5 });
    await pollShipmentStatuses();

    const order = await OrderModel.findOne({ orderNo });
    expect(order!.shipment).toMatchObject({
      awbCode: "7D000000001",
      courierName: "DTDC Surface",
      trackingUrl: "https://shiprocket.co/tracking/7D000000001",
    });
    expect(order!.shipment!.statusHistory.map((h) => h.status)).toContain("AWB ASSIGNED");
  });

  it("schedule pickup syncs a pickup already booked in the dashboard instead of booking twice", async () => {
    const orderNo = await startWithoutAwb();
    const booked = new Date("2026-11-26T15:24:13Z");
    vi.spyOn(getShippingProvider(), "getShipmentAwb").mockResolvedValue({
      awbCode: "7D000000003",
      courierId: "6",
      courierName: "DTDC Surface",
      trackingUrl: "https://shiprocket.co/tracking/7D000000003",
      pickupScheduledDate: booked,
    });
    const schedule = vi.spyOn(getShippingProvider(), "schedulePickup");

    const res = await gql(
      `mutation ($n: String!) { schedulePickup(orderNo: $n) { shipment { awbCode pickupScheduledDate } } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(res.errors).toBeUndefined();
    expect(res.data.schedulePickup.shipment.awbCode).toBe("7D000000003");
    expect(new Date(res.data.schedulePickup.shipment.pickupScheduledDate).getTime()).toBe(booked.getTime());
    expect(schedule).not.toHaveBeenCalled();
  });

  it("schedule pickup says why when there is still no AWB", async () => {
    const orderNo = await startWithoutAwb();
    vi.spyOn(getShippingProvider(), "getShipmentAwb").mockResolvedValue(null);
    const res = await gql(
      `mutation ($n: String!) { schedulePickup(orderNo: $n) { status } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
    expect(res.errors?.[0]?.message).toMatch(/No AWB/);
  });

  it("a carrier rejection reaches the admin as its reason, not an internal error", async () => {
    await updateAutomationSettings({ autoSchedulePickup: false });
    const orderNo = await placePackedOrder();
    await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
    await gql(`mutation ($n: String!) { startDelivery(orderNo: $n) { status } }`, { n: orderNo }, adminAuth);
    vi.spyOn(getShippingProvider(), "schedulePickup").mockRejectedValue(
      new CarrierError("Shiprocket", "Already in Pickup Queue.", "raw detail"),
    );
    const res = await gql(
      `mutation ($n: String!) { schedulePickup(orderNo: $n) { status } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
    expect(res.errors?.[0]?.message).toBe("Shiprocket couldn't schedule the pickup: Already in Pickup Queue.");
  });

  it("a webhook for the order fills in the AWB by order number", async () => {
    const orderNo = await startWithoutAwb();
    await syncShipmentStatus("7D000000002", "PICKED UP", false, { orderNo, courierName: "DTDC Surface" });

    const order = await OrderModel.findOne({ orderNo });
    expect(order!.shipment).toMatchObject({
      awbCode: "7D000000002",
      courierName: "DTDC Surface",
      rawStatus: "PICKED UP",
    });
  });
});

describe("shipping parcel", () => {
  it("stacks packed boxes and adds weights; missing details fall back to the default unit", async () => {
    const { combineParcel } = await import("../src/modules/shipping/package.js");
    const p = combineParcel([
      { slug: "idol", qty: 2, unit: { weightGrams: 800, lengthCm: 12, breadthCm: 20, heightCm: 8 } },
      { slug: "coin", qty: 1, unit: { weightGrams: 50, lengthCm: 6, breadthCm: 6, heightCm: 2 } },
    ]);
    expect(p).toEqual({ lengthCm: 20, breadthCm: 12, heightCm: 18, weightKg: 1.65, estimated: [] });

    const partial = combineParcel([{ slug: "bare", qty: 1, unit: { weightGrams: 300 } }]);
    expect(partial).toMatchObject({ lengthCm: 15, breadthCm: 10, heightCm: 10, weightKg: 0.5, estimated: ["bare"] });
  });

  it("is saved from the product form and shown on the admin order", async () => {
    await gql(
      `mutation { upsertProduct(input: { slug: "test-ganesha", weightGrams: 750, lengthCm: 18, breadthCm: 14, heightCm: 22 }) { weightGrams heightCm } }`,
      {},
      adminAuth,
    );
    const orderNo = await placePackedOrder();
    const res = await gql(
      `query($o: String!) { adminOrder(orderNo: $o) { shippingParcel { lengthCm breadthCm heightCm weightKg estimated } } }`,
      { o: orderNo },
      adminAuth,
    );
    expect(res.errors).toBeUndefined();
    expect((res.data as any).adminOrder.shippingParcel).toEqual({
      lengthCm: 22, breadthCm: 18, heightCm: 14, weightKg: 0.75, estimated: [],
    });
  });
});
