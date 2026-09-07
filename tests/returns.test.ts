import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ProductModel } from "../src/modules/catalog/product.model.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { ALL_PERMISSION_KEYS } from "../src/modules/roles/permission-catalog.js";
import { syncShipmentStatus } from "../src/modules/shipping/shipping.service.js";
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

async function placeDeliveredOrder(qty = 2): Promise<string> {
  const cartId = `cart-${Math.random()}`;
  await gql(`mutation { addToCart(anonId: "${cartId}", productSlug: "test-ganesha", qty: ${qty}) { itemCount } }`);
  const placed = await gql(
    `mutation { placeOrder(input: {
      email: "a@test.com", paymentMethod: cod, anonId: "${cartId}",
      shippingAddress: { firstName: "A", line1: "L1", city: "C", state: "S", pincode: "110001" }
    }) { order { orderNo } } }`,
  );
  const orderNo = placed.data.placeOrder.order.orderNo as string;

  await gql(`mutation ($n: String!) { advanceOrderStatus(orderNo: $n, status: packed) { status } }`, { n: orderNo }, adminAuth);
  await gql(`mutation ($n: String!) { verifyOrder(orderNo: $n) { verifiedAt } }`, { n: orderNo }, adminAuth);
  const started = await gql(
    `mutation ($n: String!) { startDelivery(orderNo: $n) { shipment { awbCode } } }`,
    { n: orderNo },
    adminAuth,
  );
  const awbCode = started.data.startDelivery.shipment.awbCode as string;
  await syncShipmentStatus(awbCode, "DELIVERED", true);
  return orderNo;
}

describe("return eligibility", () => {
  it("is ineligible before delivery", async () => {
    await gql(`mutation { addToCart(anonId: "c1", productSlug: "test-ganesha", qty: 1) { itemCount } }`);
    const placed = await gql(
      `mutation { placeOrder(input: {
        email: "a@test.com", paymentMethod: cod, anonId: "c1",
        shippingAddress: { firstName: "A", line1: "L1", city: "C", state: "S", pincode: "110001" }
      }) { order { orderNo } } }`,
    );
    const orderNo = placed.data.placeOrder.order.orderNo;
    const res = await gql(
      `query ($n: String!) { returnEligibility(orderNo: $n) { eligible reason } }`,
      { n: orderNo },
      adminAuth, // any authenticated context works; getOrder allows admin? no — loggedIn only, admin token has a user
    );
    expect(res.data.returnEligibility.eligible).toBe(false);
    expect(res.data.returnEligibility.reason).toMatch(/not been delivered/);
  });

  it("is eligible after delivery, listing returnable items", async () => {
    const orderNo = await placeDeliveredOrder(3);
    const res = await gql(
      `query ($n: String!) { returnEligibility(orderNo: $n) { eligible items { productSlug maxQty } } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(res.data.returnEligibility.eligible).toBe(true);
    expect(res.data.returnEligibility.items).toEqual([
      { productSlug: "test-ganesha", maxQty: 3 },
    ]);
  });
});

describe("return lifecycle", () => {
  it("walks requested → approved → pickup_scheduled → received → refunded", async () => {
    const orderNo = await placeDeliveredOrder(2);

    const requested = await gql(
      `mutation ($n: String!) {
        requestReturn(orderNo: $n, items: [{ productSlug: "test-ganesha", qty: 1, reason: "Wrong item" }]) {
          returnNo status items { qty reason }
        }
      }`,
      { n: orderNo },
      adminAuth,
    );
    expect(requested.data.requestReturn.status).toBe("requested");
    const returnNo = requested.data.requestReturn.returnNo as string;

    const approved = await gql(
      `mutation ($n: String!) { approveReturn(returnNo: $n) { status } }`,
      { n: returnNo },
      adminAuth,
    );
    expect(approved.data.approveReturn.status).toBe("approved");

    const scheduled = await gql(
      `mutation ($n: String!) { scheduleReturnPickup(returnNo: $n) { status shipment { awbCode courierName } } }`,
      { n: returnNo },
      adminAuth,
    );
    expect(scheduled.data.scheduleReturnPickup.status).toBe("pickup_scheduled");
    expect(scheduled.data.scheduleReturnPickup.shipment.awbCode).toContain("MOCKRETAWB");

    const received = await gql(
      `mutation ($n: String!) { markReturnReceived(returnNo: $n) { status } }`,
      { n: returnNo },
      adminAuth,
    );
    expect(received.data.markReturnReceived.status).toBe("received");

    const refunded = await gql(
      `mutation ($n: String!) { refundReturn(returnNo: $n, amount: 1000) { status refundAmount } }`,
      { n: returnNo },
      adminAuth,
    );
    expect(refunded.data.refundReturn.status).toBe("refunded");
    expect(refunded.data.refundReturn.refundAmount).toBe(1000);
  });

  it("rejects a return and frees the item back up for another request", async () => {
    const orderNo = await placeDeliveredOrder(1);
    const first = await gql(
      `mutation ($n: String!) { requestReturn(orderNo: $n, items: [{ productSlug: "test-ganesha", qty: 1, reason: "Damaged" }]) { returnNo } }`,
      { n: orderNo },
      adminAuth,
    );
    await gql(
      `mutation ($n: String!) { rejectReturn(returnNo: $n, note: "Item shows no damage") { status } }`,
      { n: first.data.requestReturn.returnNo },
      adminAuth,
    );

    const eligibility = await gql(
      `query ($n: String!) { returnEligibility(orderNo: $n) { eligible items { maxQty } } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(eligibility.data.returnEligibility.eligible).toBe(true);
    expect(eligibility.data.returnEligibility.items[0].maxQty).toBe(1);
  });

  it("rejects requesting more than the eligible quantity", async () => {
    const orderNo = await placeDeliveredOrder(1);
    const res = await gql(
      `mutation ($n: String!) { requestReturn(orderNo: $n, items: [{ productSlug: "test-ganesha", qty: 5, reason: "x" }]) { returnNo } }`,
      { n: orderNo },
      adminAuth,
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });
});

describe("returns permission scoping", () => {
  it("lets a returns.view-only role see returns but not act on them", async () => {
    const role = await gql(
      `mutation { createRole(input: { name: "Returns Viewer", permissions: ["returns.view"] }) { id } }`,
      undefined,
      adminAuth,
    );
    const { UserModel } = await import("../src/modules/auth/auth.model.js");
    const { hashPassword } = await import("../src/shared/auth/password.js");
    const user = await UserModel.create({
      email: "viewer@test.com",
      passwordHash: await hashPassword("secret123"),
      name: "Viewer",
      roles: ["admin", "customer"],
      referralCode: "SEEKER-VIEWER1",
    });
    await gql(
      `mutation ($u: ID!, $r: [ID!]!) { assignUserRoles(userId: $u, roleIds: $r) { id } }`,
      { u: String(user._id), r: [role.data.createRole.id] },
      adminAuth,
    );
    const login = await gql(
      `mutation { login(input: { email: "viewer@test.com", password: "secret123" }) { accessToken } }`,
    );
    const scopedAuth = { authorization: `Bearer ${login.data.login.accessToken}` };

    const view = await gql(`{ adminReturns(page: 1, pageSize: 5) { total } }`, undefined, scopedAuth);
    expect(view.errors).toBeUndefined();

    const manage = await gql(
      `mutation { approveReturn(returnNo: "RET-000-Om") { status } }`,
      undefined,
      scopedAuth,
    );
    expect(manage.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  });
});
