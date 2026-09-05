import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { ProductModel } from "../src/modules/catalog/product.model.js";
import { OrderModel } from "../src/modules/order/order.model.js";
import { ConsultationBookingModel } from "../src/modules/consultation/consultation.model.js";
import {
  ContactSubmissionModel,
  NewsletterSubscriberModel,
} from "../src/modules/marketing/marketing.model.js";
import { UserModel } from "../src/modules/auth/auth.model.js";
import { hashPassword } from "../src/shared/auth/password.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(resetDb);

// Scope enforcement reads `ctx.user.roles` off the access token — no DB user
// record is needed to exercise it.
const adminToken = signAccessToken({ sub: "000000000000000000000001", roles: ["admin"] });
const customerToken = signAccessToken({
  sub: "000000000000000000000002",
  roles: ["customer"],
});
const asAdmin = { authorization: `Bearer ${adminToken}` };
const asCustomer = { authorization: `Bearer ${customerToken}` };

describe("admin scope enforcement", () => {
  it("rejects a non-admin token as forbidden", async () => {
    const res = await gql(`{ adminOrders { total } }`, undefined, asCustomer);
    expect(res.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  });

  it("rejects an anonymous request as unauthenticated", async () => {
    const res = await gql(`{ adminOrders { total } }`);
    expect(res.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });
});

describe("adminOrders / adminProducts", () => {
  beforeEach(async () => {
    await OrderModel.create([
      orderFixture({ orderNo: "VV-001-Om", email: "a@test.com", status: "pending_payment" }),
      orderFixture({ orderNo: "VV-002-Om", email: "b@test.com", status: "paid" }),
    ]);
    await ProductModel.create([
      { slug: "draft-item", name: { en: "Draft", hi: "d" }, tagline: { en: "t", hi: "t" }, description: { en: "d", hi: "d" }, price: 100, category: "idols", image: "/x.jpg", status: "draft" },
      { slug: "active-item", name: { en: "Active", hi: "a" }, tagline: { en: "t", hi: "t" }, description: { en: "d", hi: "d" }, price: 200, category: "idols", image: "/x.jpg", status: "active" },
    ]);
  });

  it("paginates and filters orders by status", async () => {
    const all = await gql(`{ adminOrders { total items { orderNo } } }`, undefined, asAdmin);
    expect(all.data.adminOrders.total).toBe(2);

    const filtered = await gql(
      `query ($s: OrderStatus) { adminOrders(filter: { status: $s }) { total items { orderNo status } } }`,
      { s: "paid" },
      asAdmin,
    );
    expect(filtered.data.adminOrders.total).toBe(1);
    expect(filtered.data.adminOrders.items[0].orderNo).toBe("VV-002-Om");
  });

  it("exposes allowedTransitions only to admins", async () => {
    const asCustomerRes = await gql(
      `{ adminOrders { items { orderNo } } }`,
      undefined,
      asCustomer,
    );
    expect(asCustomerRes.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");

    const res = await gql(
      `query { adminOrders(filter: { status: pending_payment }) { items { allowedTransitions } } }`,
      undefined,
      asAdmin,
    );
    expect(res.data.adminOrders.items[0].allowedTransitions).toEqual(
      expect.arrayContaining(["paid", "cancelled"]),
    );
  });

  it("includes non-active products for admins, defaults to active-only otherwise", async () => {
    const admin = await gql(
      `{ adminProducts { total items { slug status } } }`,
      undefined,
      asAdmin,
    );
    expect(admin.data.adminProducts.total).toBe(2);

    const publicList = await gql(`{ products { total items { slug } } }`);
    expect(publicList.data.products.items.map((p: any) => p.slug)).toEqual(["active-item"]);
  });
});

describe("product lifecycle", () => {
  it("archives then restores a product", async () => {
    await ProductModel.create({
      slug: "cycle-item",
      name: { en: "Cycle", hi: "c" },
      tagline: { en: "t", hi: "t" },
      description: { en: "d", hi: "d" },
      price: 100,
      category: "idols",
      image: "/x.jpg",
    });

    const archived = await gql(
      `mutation { archiveProduct(slug: "cycle-item") { status } }`,
      undefined,
      asAdmin,
    );
    expect(archived.data.archiveProduct.status).toBe("archived");

    const restored = await gql(
      `mutation { restoreProduct(slug: "cycle-item") { status } }`,
      undefined,
      asAdmin,
    );
    expect(restored.data.restoreProduct.status).toBe("active");
  });
});

describe("collections admin CRUD", () => {
  it("upserts, lists and deletes a collection", async () => {
    const upserted = await gql(
      `mutation ($i: CollectionInput!) {
        upsertCollection(input: $i) { slug title { en } published }
      }`,
      {
        i: {
          slug: "new-home",
          title: { en: "New Home", hi: "नया घर" },
          description: { en: "d", hi: "d" },
          published: true,
        },
      },
      asAdmin,
    );
    expect(upserted.data.upsertCollection.slug).toBe("new-home");

    const list = await gql(`{ adminCollections { slug } }`, undefined, asAdmin);
    expect(list.data.adminCollections.map((c: any) => c.slug)).toContain("new-home");

    const deleted = await gql(
      `mutation { deleteCollection(slug: "new-home") }`,
      undefined,
      asAdmin,
    );
    expect(deleted.data.deleteCollection).toBe(true);
  });
});

describe("promo codes admin CRUD", () => {
  it("upserts, lists and deletes a promo", async () => {
    const upserted = await gql(
      `mutation ($i: PromoInput!) { upsertPromo(input: $i) { code kind amount active } }`,
      { i: { code: "diwali20", kind: "percent", amount: 20 } },
      asAdmin,
    );
    expect(upserted.data.upsertPromo.code).toBe("DIWALI20");

    const list = await gql(`{ adminPromos { code } }`, undefined, asAdmin);
    expect(list.data.adminPromos.map((p: any) => p.code)).toContain("DIWALI20");

    const deleted = await gql(
      `mutation { deletePromo(code: "diwali20") }`,
      undefined,
      asAdmin,
    );
    expect(deleted.data.deletePromo).toBe(true);
  });
});

describe("refundOrder", () => {
  it("moves a paid order to refunded, and rejects an illegal state", async () => {
    await OrderModel.create(
      orderFixture({ orderNo: "VV-900-Om", email: "r@test.com", status: "paid" }),
    );

    const refunded = await gql(
      `mutation { refundOrder(orderNo: "VV-900-Om") { status } }`,
      undefined,
      asAdmin,
    );
    expect(refunded.data.refundOrder.status).toBe("refunded");

    await OrderModel.create(
      orderFixture({ orderNo: "VV-901-Om", email: "r2@test.com", status: "pending_payment" }),
    );
    const illegal = await gql(
      `mutation { refundOrder(orderNo: "VV-901-Om") { status } }`,
      undefined,
      asAdmin,
    );
    expect(illegal.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });
});

describe("bookings admin", () => {
  it("lists and updates a consultation booking", async () => {
    const booking = await ConsultationBookingModel.create({
      serviceKey: "vastu",
      date: "2026-09-10",
      slot: "10:30",
      name: "Priya",
      email: "priya@test.com",
      phone: "9999999999",
      notes: "Wants a home visit",
      status: "requested",
    });

    const list = await gql(
      `{ adminBookings { total items { id name status phone notes } } }`,
      undefined,
      asAdmin,
    );
    expect(list.data.adminBookings.total).toBe(1);
    expect(list.data.adminBookings.items[0].phone).toBe("9999999999");

    const updated = await gql(
      `mutation ($id: ID!) { updateBookingStatus(id: $id, status: confirmed) { status } }`,
      { id: String(booking._id) },
      asAdmin,
    );
    expect(updated.data.updateBookingStatus.status).toBe("confirmed");
  });
});

describe("contact submissions admin", () => {
  it("lists and triages a contact submission", async () => {
    const submission = await ContactSubmissionModel.create({
      name: "Rahul",
      email: "rahul@test.com",
      message: "Question about shipping",
    });

    const list = await gql(
      `{ adminContactSubmissions { total items { id status message } } }`,
      undefined,
      asAdmin,
    );
    expect(list.data.adminContactSubmissions.total).toBe(1);
    expect(list.data.adminContactSubmissions.items[0].status).toBe("new");

    const updated = await gql(
      `mutation ($id: ID!) { updateContactStatus(id: $id, status: responded) { status } }`,
      { id: String(submission._id) },
      asAdmin,
    );
    expect(updated.data.updateContactStatus.status).toBe("responded");
  });
});

describe("newsletter subscribers admin", () => {
  it("lists and unsubscribes a subscriber", async () => {
    await NewsletterSubscriberModel.create({ email: "seeker@test.com" });

    const list = await gql(
      `{ adminNewsletterSubscribers { total items { email status } } }`,
      undefined,
      asAdmin,
    );
    expect(list.data.adminNewsletterSubscribers.total).toBe(1);

    const updated = await gql(
      `mutation ($e: String!) { updateSubscriberStatus(email: $e, status: unsubscribed) { status } }`,
      { e: "seeker@test.com" },
      asAdmin,
    );
    expect(updated.data.updateSubscriberStatus.status).toBe("unsubscribed");
  });
});

describe("users admin", () => {
  it("lists users and reports per-user stats", async () => {
    const user = await UserModel.create({
      email: "customer@test.com",
      passwordHash: await hashPassword("secret123"),
      name: "Priya Sharma",
      referralCode: "SEEKER-TEST01",
    });
    await OrderModel.create(
      orderFixture({ orderNo: "VV-700-Om", email: user.email, status: "paid" }),
    ).then((o) => {
      o.userId = user._id;
      return o.save();
    });

    const list = await gql(
      `{ adminUsers { total items { id name email } } }`,
      undefined,
      asAdmin,
    );
    expect(list.data.adminUsers.total).toBe(1);

    const detail = await gql(
      `query ($id: ID!) { adminUser(id: $id) { orderCount totalSpent } }`,
      { id: String(user._id) },
      asAdmin,
    );
    expect(detail.data.adminUser.orderCount).toBe(1);
    expect(detail.data.adminUser.totalSpent).toBe(100);
  });

  it("refuses to let an admin remove their own admin role", async () => {
    const admin = await UserModel.create({
      email: "self@test.com",
      passwordHash: await hashPassword("secret123"),
      name: "Self Admin",
      roles: ["admin", "customer"],
      referralCode: "SEEKER-TEST02",
    });
    const token = signAccessToken({ sub: String(admin._id), roles: ["admin"] });

    const res = await gql(
      `mutation ($id: ID!) { setUserRoles(userId: $id, roles: [customer]) { id } }`,
      { id: String(admin._id) },
      { authorization: `Bearer ${token}` },
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("refuses to demote the last remaining admin", async () => {
    const onlyAdmin = await UserModel.create({
      email: "lastadmin@test.com",
      passwordHash: await hashPassword("secret123"),
      name: "Last Admin",
      roles: ["admin", "customer"],
      referralCode: "SEEKER-TEST03",
    });

    const res = await gql(
      `mutation ($id: ID!) { setUserRoles(userId: $id, roles: [customer]) { id } }`,
      { id: String(onlyAdmin._id) },
      asAdmin, // acting as the synthetic admin token, not `onlyAdmin` itself
    );
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("allows demoting an admin when another admin remains", async () => {
    const [admin1, admin2] = await UserModel.create([
      {
        email: "admin1@test.com",
        passwordHash: await hashPassword("secret123"),
        name: "Admin One",
        roles: ["admin", "customer"],
        referralCode: "SEEKER-TEST04",
      },
      {
        email: "admin2@test.com",
        passwordHash: await hashPassword("secret123"),
        name: "Admin Two",
        roles: ["admin", "customer"],
        referralCode: "SEEKER-TEST05",
      },
    ]);
    void admin1;

    const res = await gql(
      `mutation ($id: ID!) { setUserRoles(userId: $id, roles: [customer]) { roles } }`,
      { id: String(admin2._id) },
      asAdmin,
    );
    expect(res.data.setUserRoles.roles).toEqual(["customer"]);
  });
});

describe("content admin CRUD", () => {
  it("upserts and deletes a testimonial", async () => {
    const upserted = await gql(
      `mutation ($i: TestimonialInput!) { upsertTestimonial(input: $i) { id key name } }`,
      {
        i: {
          key: "priya-delhi",
          name: "Priya",
          meta: { en: "Delhi", hi: "दिल्ली" },
          rating: 5,
          quote: { en: "Wonderful", hi: "अद्भुत" },
          image: "/p.jpg",
        },
      },
      asAdmin,
    );
    expect(upserted.data.upsertTestimonial.key).toBe("priya-delhi");

    const list = await gql(`{ adminTestimonials { key } }`, undefined, asAdmin);
    expect(list.data.adminTestimonials.map((t: any) => t.key)).toContain("priya-delhi");

    const deleted = await gql(
      `mutation ($id: ID!) { deleteTestimonial(id: $id) }`,
      { id: upserted.data.upsertTestimonial.id },
      asAdmin,
    );
    expect(deleted.data.deleteTestimonial).toBe(true);
  });

  it("upserts and deletes a FAQ", async () => {
    const upserted = await gql(
      `mutation ($i: FaqInput!) { upsertFaq(input: $i) { id key } }`,
      {
        i: {
          key: "shipping-time",
          question: { en: "How long?", hi: "कितना समय?" },
          answer: { en: "5 days", hi: "5 दिन" },
        },
      },
      asAdmin,
    );
    expect(upserted.data.upsertFaq.key).toBe("shipping-time");

    const deleted = await gql(
      `mutation ($id: ID!) { deleteFaq(id: $id) }`,
      { id: upserted.data.upsertFaq.id },
      asAdmin,
    );
    expect(deleted.data.deleteFaq).toBe(true);
  });

  it("upserts a legal doc and round-trips its raw SEO override", async () => {
    const upserted = await gql(
      `mutation ($i: LegalDocInput!) {
        upsertLegalDoc(input: $i) {
          slug
          sections { heading { en } }
          seoRaw { noindex canonicalPath }
        }
      }`,
      {
        i: {
          slug: "test-policy",
          title: { en: "Test Policy", hi: "परीक्षण नीति" },
          sections: [{ heading: { en: "Intro", hi: "परिचय" }, body: { en: "b", hi: "b" } }],
          seo: { noindex: true, canonicalPath: "/legal/test-policy" },
        },
      },
      asAdmin,
    );
    expect(upserted.data.upsertLegalDoc.seoRaw.noindex).toBe(true);
    expect(upserted.data.upsertLegalDoc.sections[0].heading.en).toBe("Intro");

    const deleted = await gql(
      `mutation { deleteLegalDoc(slug: "test-policy") }`,
      undefined,
      asAdmin,
    );
    expect(deleted.data.deleteLegalDoc).toBe(true);
  });

  it("sets a page's SEO override without freezing the resolved fallback", async () => {
    const upserted = await gql(
      `mutation ($i: PageInput!) {
        upsertPage(input: $i) { key seoRaw { noindex } }
      }`,
      { i: { key: "about", seo: { noindex: true } } },
      asAdmin,
    );
    expect(upserted.data.upsertPage.seoRaw.noindex).toBe(true);
  });
});

describe("site settings, redirects & announcement bar admin", () => {
  it("updates site settings", async () => {
    const res = await gql(
      `mutation ($i: SiteSettingsInput!) { updateSiteSettings(input: $i) { name email } }`,
      { i: { name: "Vastukosh Test", email: "hello@test.com" } },
      asAdmin,
    );
    expect(res.data.updateSiteSettings.name).toBe("Vastukosh Test");
  });

  it("upserts and deletes a redirect", async () => {
    const upserted = await gql(
      `mutation ($i: RedirectInput!) { upsertRedirect(input: $i) { from to statusCode } }`,
      { i: { from: "/old", to: "/new", statusCode: 301 } },
      asAdmin,
    );
    expect(upserted.data.upsertRedirect.to).toBe("/new");

    const deleted = await gql(`mutation { deleteRedirect(from: "/old") }`, undefined, asAdmin);
    expect(deleted.data.deleteRedirect).toBe(true);
  });

  it("updates the announcement bar and it's readable publicly", async () => {
    const updated = await gql(
      `mutation ($i: AnnouncementInput!) { updateAnnouncementBar(input: $i) { enabled text { en } } }`,
      { i: { enabled: false, text: { en: "Sale!", hi: "बिक्री!" } } },
      asAdmin,
    );
    expect(updated.data.updateAnnouncementBar.enabled).toBe(false);

    const publicRead = await gql(`{ announcementBar { enabled text { en } } }`);
    expect(publicRead.data.announcementBar.enabled).toBe(false);
    expect(publicRead.data.announcementBar.text.en).toBe("Sale!");
  });
});

describe("admin dashboard", () => {
  it("aggregates revenue and order counts", async () => {
    await OrderModel.create([
      orderFixture({ orderNo: "VV-800-Om", email: "d1@test.com", status: "paid" }),
      orderFixture({ orderNo: "VV-801-Om", email: "d2@test.com", status: "pending_payment" }),
    ]);

    const res = await gql(`{ adminDashboard { revenueTotal ordersTotal ordersByStatus { status count } } }`, undefined, asAdmin);
    expect(res.data.adminDashboard.revenueTotal).toBe(100);
    expect(res.data.adminDashboard.ordersTotal).toBe(2);
  });
});

function orderFixture(overrides: { orderNo: string; email: string; status: string }) {
  return {
    ...overrides,
    items: [
      {
        productSlug: "x",
        name: { en: "X", hi: "X" },
        image: "/x.jpg",
        unitPrice: 100,
        qty: 1,
        lineTotal: 100,
      },
    ],
    subtotal: 100,
    total: 100,
    shippingAddress: {
      firstName: "A",
      line1: "L1",
      city: "C",
      state: "S",
      pincode: "110001",
    },
    payment: { provider: "mock", method: "cod" },
    timeline: [{ status: overrides.status, at: new Date() }],
  };
}
