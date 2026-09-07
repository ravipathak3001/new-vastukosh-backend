import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ProductModel } from "../src/modules/catalog/product.model.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { OrderModel } from "../src/modules/order/order.model.js";
import {
  pollShipmentStatuses,
  syncShipmentStatus,
  updateAutomationSettings,
} from "../src/modules/shipping/shipping.service.js";
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
