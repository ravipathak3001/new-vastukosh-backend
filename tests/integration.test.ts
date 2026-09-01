import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ProductModel } from "../src/modules/catalog/product.model.js";
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
  });
  await PromoModel.create({ code: "SHANTI20", kind: "percent", amount: 20 });
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
