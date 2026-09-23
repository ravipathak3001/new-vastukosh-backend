import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ProductModel } from "../src/modules/catalog/product.model.js";
import { StoneModel } from "../src/modules/catalog/stone.model.js";
import { PromoModel } from "../src/modules/cart/cart.model.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();

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
  await PromoModel.create({ code: "SHANTI20", kind: "percent", amount: 20 });
  await StoneModel.create([
    { slug: "red-coral", name: { en: "Red Coral", hi: "मूंगा" }, grahas: ["Mars"], primary: true, pricePerBead: 150 },
    { slug: "carnelian", name: { en: "Carnelian", hi: "कार्नेलियन" }, grahas: ["Mars"], primary: false, pricePerBead: 12 },
    {
      slug: "discontinued-stone",
      name: { en: "Discontinued", hi: "d" },
      grahas: ["Mars"],
      primary: false,
      pricePerBead: 5,
      status: "archived",
    },
  ]);
});

describe("auth", () => {
  it("signs up, authenticates `me`, and rotates refresh tokens", async () => {
    const signup = await gql(
      `mutation ($i: SignupInput!) { signup(input: $i) { accessToken refreshToken user { email } } }`,
      { i: { name: "A", email: "a@test.com", password: "secret123" } },
    );
    const { accessToken, refreshToken } = signup.data.signup;
    expect(signup.data.signup.user.email).toBe("a@test.com");

    const me = await gql(`{ me { email } }`, undefined, {
      authorization: `Bearer ${accessToken}`,
    });
    expect(me.data.me.email).toBe("a@test.com");

    const rotated = await gql(
      `mutation ($t: String!) { refreshToken(refreshToken: $t) { accessToken } }`,
      { t: refreshToken },
    );
    expect(rotated.data.refreshToken.accessToken).toBeTruthy();

    // Reusing the now-revoked token must fail.
    const reuse = await gql(
      `mutation ($t: String!) { refreshToken(refreshToken: $t) { accessToken } }`,
      { t: refreshToken },
    );
    expect(reuse.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });
});

describe("cart → order", () => {
  it("computes totals with a promo and settles a mock order", async () => {
    const add = await gql(
      `mutation { addToCart(anonId: "g1", productSlug: "test-ganesha", qty: 3) { itemCount totals { subtotal } } }`,
    );
    expect(add.data.addToCart.itemCount).toBe(3);
    expect(add.data.addToCart.totals.subtotal).toBe(3000);

    const promo = await gql(
      `mutation { applyPromo(anonId: "g1", code: "SHANTI20") { totals { discount total shipping } } }`,
    );
    expect(promo.data.applyPromo.totals.discount).toBe(600);
    expect(promo.data.applyPromo.totals.shipping).toBe(99); // 2400 < free-shipping threshold

    const placed = await gql(
      `mutation { placeOrder(input: {
        email: "a@test.com", paymentMethod: cod, anonId: "g1",
        shippingAddress: { firstName: "A", line1: "L1", city: "C", state: "S", pincode: "110001" }
      }) { order { status total timeline { status } } } }`,
    );
    expect(placed.data.placeOrder.order.status).toBe("consecration");
    expect(placed.data.placeOrder.order.total).toBe(2499);

    const cart = await gql(`{ cart(anonId: "g1") { itemCount } }`);
    expect(cart.data.cart.itemCount).toBe(0);
  });
});

describe("stock enforcement", () => {
  it("rejects adding an out-of-stock item to the cart", async () => {
    await ProductModel.updateOne({ slug: "test-ganesha" }, { $set: { stockQty: 0 } });
    const add = await gql(
      `mutation { addToCart(anonId: "g2", productSlug: "test-ganesha", qty: 1) { itemCount } }`,
    );
    expect(add.errors?.[0]?.message).toMatch(/out of stock/i);
  });

  it("caps cart quantity at the available stock", async () => {
    await ProductModel.updateOne({ slug: "test-ganesha" }, { $set: { stockQty: 2 } });
    const add = await gql(
      `mutation { addToCart(anonId: "g3", productSlug: "test-ganesha", qty: 5) { itemCount } }`,
    );
    expect(add.data.addToCart.itemCount).toBe(2);
  });

  it("decrements stock on order placement and restores it on cancellation", async () => {
    await gql(`mutation { addToCart(anonId: "g4", productSlug: "test-ganesha", qty: 3) { itemCount } }`);
    const placed = await gql(
      `mutation { placeOrder(input: {
        email: "s@test.com", paymentMethod: cod, anonId: "g4",
        shippingAddress: { firstName: "A", line1: "L1", city: "C", state: "S", pincode: "110001" }
      }) { order { orderNo status } } }`,
    );
    const orderNo = placed.data.placeOrder.order.orderNo as string;
    expect(placed.data.placeOrder.order.status).toBe("consecration");

    const afterOrder = await ProductModel.findOne({ slug: "test-ganesha" });
    expect(afterOrder!.stockQty).toBe(97);

    const cancelled = await gql(
      `mutation ($n: String!) { cancelOrder(orderNo: $n, anonId: "g4") { status } }`,
      { n: orderNo },
    );
    expect(cancelled.data.cancelOrder.status).toBe("cancelled");

    const afterCancel = await ProductModel.findOne({ slug: "test-ganesha" });
    expect(afterCancel!.stockQty).toBe(100);
  });

  it("rejects placing an order for more than the available stock", async () => {
    await ProductModel.updateOne({ slug: "test-ganesha" }, { $set: { stockQty: 100 } });
    await gql(`mutation { addToCart(anonId: "g5", productSlug: "test-ganesha", qty: 5) { itemCount } }`);
    // Sell down the stock from under the cart after it was added, to force the
    // final placeOrder-time check (not just the addToCart-time cap) to fire.
    await ProductModel.updateOne({ slug: "test-ganesha" }, { $set: { stockQty: 2 } });

    const placed = await gql(
      `mutation { placeOrder(input: {
        email: "s2@test.com", paymentMethod: cod, anonId: "g5",
        shippingAddress: { firstName: "A", line1: "L1", city: "C", state: "S", pincode: "110001" }
      }) { order { status } } }`,
    );
    expect(placed.errors?.[0]?.message).toMatch(/enough stock/i);

    const stillHas = await ProductModel.findOne({ slug: "test-ganesha" });
    expect(stillHas!.stockQty).toBe(2); // nothing was decremented
  });
});

describe("custom bracelets", () => {
  const design = "custom:Mars:carnelian:9,Mars:red-coral:12"; // fabricated multi-segment for the maths — no real astrology needed for this test

  it("prices a custom bracelet from its segments' current stone prices, not a stored product price", async () => {
    const add = await gql(
      `mutation ($slug: String!) { addToCart(anonId: "c1", productSlug: $slug, qty: 1) { itemCount totals { subtotal } } }`,
      { slug: design },
    );
    expect(add.data.addToCart.itemCount).toBe(1);
    // 9*12 (carnelian) + 12*150 (red coral) = 108 + 1800
    expect(add.data.addToCart.totals.subtotal).toBe(1908);
  });

  it("places an order for a custom bracelet, and does not touch any product's stock for it", async () => {
    await gql(`mutation ($slug: String!) { addToCart(anonId: "c2", productSlug: $slug, qty: 2) { itemCount } }`, {
      slug: design,
    });
    const placed = await gql(
      `mutation { placeOrder(input: {
        email: "s@test.com", paymentMethod: cod, anonId: "c2",
        shippingAddress: { firstName: "A", line1: "L1", city: "C", state: "S", pincode: "110001" }
      }) { order { status total items { productSlug qty unitPrice } } } }`,
    );
    expect(placed.data.placeOrder.order.status).toBe("consecration");
    expect(placed.data.placeOrder.order.total).toBe(1908 * 2);
    expect(placed.data.placeOrder.order.items).toEqual([
      { productSlug: design, qty: 2, unitPrice: 1908 },
    ]);

    // Reserving stock for a made-to-order bracelet is a deliberate no-op, not a bug — confirm no
    // Product row anywhere was touched (there isn't even one matching this slug to touch).
    const anyNegative = await ProductModel.findOne({ stockQty: { $lt: 0 } });
    expect(anyNegative).toBeNull();
  });

  it("rejects adding a custom bracelet that references an inactive stone", async () => {
    const add = await gql(
      `mutation { addToCart(anonId: "c3", productSlug: "custom:Mars:discontinued-stone:9", qty: 1) { itemCount } }`,
    );
    expect(add.errors?.[0]?.message).toBeTruthy();
  });

  it("rejects a malformed custom-bracelet slug", async () => {
    const add = await gql(
      `mutation { addToCart(anonId: "c4", productSlug: "custom:not-a-valid-design", qty: 1) { itemCount } }`,
    );
    expect(add.errors?.[0]?.message).toMatch(/isn't valid/i);
  });
});

describe("SEO", () => {
  it("exposes sitemap entries with locale alternates", async () => {
    const res = await gql(`{ sitemapEntries { path alternates { hreflang } } }`);
    const paths: string[] = res.data.sitemapEntries.map((e: any) => e.path);
    expect(paths).toContain("/en");
    expect(paths).toContain("/en/shop/test-ganesha");
    const entry = res.data.sitemapEntries.find((e: any) => e.path === "/en/shop/test-ganesha");
    expect(entry.alternates.map((a: any) => a.hreflang)).toEqual(
      expect.arrayContaining(["en", "hi", "x-default"]),
    );
  });
});
