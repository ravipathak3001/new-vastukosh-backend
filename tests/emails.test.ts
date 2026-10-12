import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailOutboxModel } from "../src/modules/email/outbox.model.js";
import { deliverDueEmails } from "../src/modules/email/outbox.service.js";
import { MockEmailProvider } from "../src/modules/email/email.provider.js";
import { htmlToText } from "../src/modules/email/layout.js";
import { ProductModel } from "../src/modules/catalog/product.model.js";
import { OrderModel } from "../src/modules/order/order.model.js";
import { advanceStatus } from "../src/modules/order/order.service.js";
import {
  ConsultationBookingModel,
  ConsultationServiceModel,
  PoojaServiceModel,
} from "../src/modules/consultation/consultation.model.js";
import { sendDueBookingReminders } from "../src/modules/consultation/booking-reminders.js";
import { consultationServiceSeeds, poojaServiceSeeds } from "../src/db/seeds/misc.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();
const TEAM = "team@vastukosh.test";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await resetDb();
  vi.restoreAllMocks();
});

const outbox = (filter: Record<string, unknown> = {}) => EmailOutboxModel.find(filter).sort({ _id: 1 }).lean();
const kinds = async (to?: string) => (await outbox(to ? { to } : {})).map((e) => e.kind);

async function signUp(email: string, locale = "en", name = "Asha Rao") {
  return gql(
    `mutation ($i: SignupInput!) { signup(input: $i) { accessToken user { id } } }`,
    { i: { name, email, password: "secret123" } },
    { "x-locale": locale },
  );
}
const tokenFrom = (html: string) => decodeURIComponent(html.match(/verify-email\?token=([\w-]+)/)?.[1] ?? "");

describe("email verification", () => {
  it("sends a confirm link on sign-up; opening it verifies the account and sends a welcome", async () => {
    const s = await signUp("asha@test.com");
    const auth = { authorization: `Bearer ${s.data.signup.accessToken}` };
    const [verify] = await outbox({ to: "asha@test.com" });
    expect(verify?.kind).toBe("account.verify");
    expect(verify?.subject).toBe("Please confirm your email — Vastukosh");
    expect(verify?.text).toContain("Confirm my email (http://localhost:3000/en/verify-email?token=");

    const before = await gql(`{ me { emailVerified } }`, undefined, auth);
    expect(before.data.me.emailVerified).toBe(false);

    const ok = await gql(`mutation ($t: String!) { verifyEmail(token: $t) }`, { t: tokenFrom(verify!.html) });
    expect(ok.data.verifyEmail).toBe(true);
    const after = await gql(`{ me { emailVerified } }`, undefined, auth);
    expect(after.data.me.emailVerified).toBe(true);

    // Opening the same link again (e.g. from another device) still succeeds, with no second welcome.
    const again = await gql(`mutation ($t: String!) { verifyEmail(token: $t) }`, { t: tokenFrom(verify!.html) });
    expect(again.data.verifyEmail).toBe(true);
    expect(await kinds("asha@test.com")).toEqual(["account.verify", "account.welcome"]);
  });

  it("refuses a made-up link with a clear message", async () => {
    const res = await gql(`mutation { verifyEmail(token: "not-a-real-token") }`);
    expect(res.errors?.[0]?.message).toBe("This verification link is invalid or has expired");
  });

  it("limits resends to one a minute, and the old link stops working", async () => {
    const s = await signUp("ravi@test.com");
    const auth = { authorization: `Bearer ${s.data.signup.accessToken}` };
    const tooSoon = await gql(`mutation { resendVerificationEmail }`, undefined, auth);
    expect(tooSoon.errors?.[0]?.message).toMatch(/wait a minute/);

    const first = (await outbox({ to: "ravi@test.com" }))[0]!;
    const { EmailVerificationTokenModel } = await import("../src/modules/auth/auth.model.js");
    // A minute later (Mongoose guards createdAt, so move it on the raw collection).
    await EmailVerificationTokenModel.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 120_000) } });
    const resent = await gql(`mutation { resendVerificationEmail }`, undefined, auth);
    expect(resent.data.resendVerificationEmail).toBe(true);
    const old = await gql(`mutation ($t: String!) { verifyEmail(token: $t) }`, { t: tokenFrom(first.html) });
    expect(old.errors?.[0]?.message).toBe("This verification link is invalid or has expired");
  });

  it("writes to Hindi sign-ups in Hindi", async () => {
    await signUp("sunita@test.com", "hi", "सुनीता");
    const [e] = await outbox({ to: "sunita@test.com" });
    expect(e?.subject).toBe("कृपया अपना ईमेल पुष्ट करें — वास्तुकोश");
    expect(e?.html).toContain("/hi/verify-email?token=");
    expect(e?.html).toContain("नमस्ते सुनीता");
  });

  it("escapes what people type into their name", async () => {
    await signUp("x@test.com", "en", `<img src=x onerror=alert(1)>`);
    const [e] = await outbox({ to: "x@test.com" });
    expect(e?.html).not.toContain("<img src=x");
    expect(e?.html).toContain("&#60;img src=x");
  });
});

describe("password reset emails", () => {
  it("sends the reset link, then a 'password changed' notice", async () => {
    await signUp("meera@test.com");
    await gql(`mutation { requestPasswordReset(email: "meera@test.com") }`);
    const reset = (await outbox({ kind: "account.password_reset" }))[0]!;
    const token = reset.html.match(/reset-password\?token=([\w-]+)/)![1]!;
    const done = await gql(`mutation ($t: String!) { resetPassword(token: $t, newPassword: "newsecret1") }`, { t: token });
    expect(done.errors).toBeUndefined();
    expect(await kinds("meera@test.com")).toEqual(["account.verify", "account.password_reset", "account.password_changed"]);
  });
});

describe("order emails", () => {
  beforeEach(async () => {
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

  async function placeCod(locale = "en") {
    await gql(`mutation { addToCart(anonId: "g1", productSlug: "test-ganesha", qty: 2) { itemCount } }`);
    const res = await gql(
      `mutation { placeOrder(input: {
        email: "buyer@test.com", paymentMethod: cod, anonId: "g1",
        shippingAddress: { firstName: "Asha", lastName: "Rao", line1: "12 MG Road", city: "Pune", state: "MH", pincode: "411001", phone: "9811100000" }
      }) { order { orderNo } } }`,
      undefined,
      { "x-locale": locale },
    );
    return res.data.placeOrder.order.orderNo as string;
  }

  it("confirms the order to the buyer and alerts the team — once each", async () => {
    const orderNo = await placeCod();
    const buyer = await outbox({ to: "buyer@test.com" });
    expect(buyer.map((e) => e.kind)).toEqual(["order.consecration"]);
    expect(buyer[0]!.subject).toBe(`Order confirmed — ${orderNo}`);
    expect(buyer[0]!.html).toContain("Test Ganesha");
    expect(buyer[0]!.html).toContain("Cash on delivery");
    expect(buyer[0]!.html).toContain("12 MG Road");
    expect(await kinds(TEAM)).toEqual(["admin.new_order"]);
  });

  it("follows the order: shipped, delivered — and Hindi buyers get Hindi", async () => {
    const orderNo = await placeCod("hi");
    const order = (await OrderModel.findOne({ orderNo }))!;
    await advanceStatus(order, "packed");
    order.shipment = { provider: "mock", awbCode: "AWB123", courierName: "Delhivery", trackingUrl: "https://track.example/AWB123" } as never;
    await advanceStatus(order, "in_transit");
    await advanceStatus(order, "delivered");
    const buyer = await outbox({ to: "buyer@test.com" });
    expect(buyer.map((e) => e.kind)).toEqual(["order.consecration", "order.in_transit", "order.delivered"]);
    expect(buyer[0]!.subject).toBe(`ऑर्डर पुष्ट — ${orderNo}`);
    expect(buyer[0]!.html).toContain("परीक्षण गणेश");
    expect(buyer[1]!.html).toContain("https://track.example/AWB123");
    expect(buyer[1]!.html).toContain("Delhivery");
  });

  it("tells the buyer about a cancellation", async () => {
    const orderNo = await placeCod();
    await gql(`mutation { cancelOrder(orderNo: "${orderNo}", anonId: "g1") { status } }`);
    expect(await kinds("buyer@test.com")).toEqual(["order.consecration", "order.cancelled"]);
  });
});

describe("booking emails", () => {
  beforeEach(async () => {
    await ConsultationServiceModel.insertMany(consultationServiceSeeds);
    await PoojaServiceModel.insertMany(poojaServiceSeeds);
  });

  it("confirms receipt to the customer and alerts the team", async () => {
    const d = new Date(Date.now() + 5 * 86400_000);
    while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
    const res = await gql(
      `mutation ($i: CreateBookingInput!) { createBooking(input: $i) { booking { bookingNo } } }`,
      { i: { kind: "consultation", serviceKey: "astro", date: d.toISOString().slice(0, 10), slot: "10:30", name: "Vikram", email: "vikram@test.com", phone: "9822200000" } },
    );
    expect(res.errors).toBeUndefined();
    expect(await kinds("vikram@test.com")).toEqual(["booking.received"]);
    expect(await kinds(TEAM)).toEqual(["admin.new_booking"]);
  });

  it("reminds the customer an hour before a confirmed session, exactly once", async () => {
    // A confirmed booking 40 minutes from now, in IST.
    const start = Date.now() + 40 * 60_000;
    const ist = new Date(start + 5.5 * 3600_000);
    const date = ist.toISOString().slice(0, 10);
    const slot = ist.toISOString().slice(11, 16);
    const later = new Date(start + 3 * 3600_000 + 5.5 * 3600_000);
    await ConsultationBookingModel.create([
      {
        bookingNo: "VB-SOON01", kind: "consultation", serviceKey: "astro", serviceName: { en: "Astro Consultancy", hi: "ज्योतिष परामर्श" },
        date, slot, durationMin: 45, amount: 1100, name: "Anita", email: "anita@test.com", status: "confirmed",
        meeting: { provider: "mock", url: "https://meet.example/abc", eventId: "e1" }, payment: { provider: "mock", status: "captured" },
      },
      {
        bookingNo: "VB-LATER1", kind: "consultation", serviceKey: "astro", serviceName: { en: "Astro Consultancy", hi: "ज्योतिष परामर्श" },
        date: later.toISOString().slice(0, 10), slot: later.toISOString().slice(11, 16), durationMin: 45, amount: 1100,
        name: "Later", email: "later@test.com", status: "confirmed", payment: { provider: "mock", status: "captured" },
      },
    ]);
    expect(await sendDueBookingReminders()).toBe(1);
    expect(await sendDueBookingReminders()).toBe(0);
    const [r] = await outbox({ to: "anita@test.com" });
    expect(r?.kind).toBe("booking.reminder");
    expect(r?.html).toContain("https://meet.example/abc");
    expect(await kinds("later@test.com")).toEqual([]);
  });
});

describe("contact form and newsletter", () => {
  it("auto-replies to the sender and forwards the message to the team", async () => {
    await gql(
      `mutation { submitContactForm(input: { name: "Ram", email: "ram@test.com", subject: "Vastu for new flat", message: "Hello,\\nI need help." }) { ok } }`,
    );
    expect(await kinds("ram@test.com")).toEqual(["contact.received"]);
    const [team] = await outbox({ to: TEAM });
    expect(team?.kind).toBe("admin.contact");
    expect(team?.html).toContain("Hello,<br>I need help.");
  });

  it("welcomes a new subscriber once, with a working one-click unsubscribe", async () => {
    await gql(`mutation { subscribeNewsletter(email: "fan@test.com") { ok } }`);
    await gql(`mutation { subscribeNewsletter(email: "fan@test.com") { ok } }`);
    const mails = await outbox({ to: "fan@test.com" });
    expect(mails.map((m) => m.kind)).toEqual(["newsletter.welcome"]);
    const link = new URL(mails[0]!.html.match(/href="([^"]*unsubscribe[^"]*)"/)![1]!.replace(/&#38;/g, "&"));
    const bad = await gql(`mutation { unsubscribeNewsletter(email: "fan@test.com", token: "forged") { ok } }`);
    expect(bad.errors?.[0]?.message).toBe("This unsubscribe link isn't valid");
    const ok = await gql(`mutation ($e: String!, $t: String!) { unsubscribeNewsletter(email: $e, token: $t) { ok } }`, {
      e: link.searchParams.get("e"),
      t: link.searchParams.get("t"),
    });
    expect(ok.data.unsubscribeNewsletter.ok).toBe(true);
  });
});

describe("delivery and retries", () => {
  it("marks emails sent, and retries later when the mail server fails", async () => {
    await signUp("a@test.com");
    await signUp("b@test.com");
    const send = vi.spyOn(MockEmailProvider.prototype, "send").mockRejectedValueOnce(new Error("SMTP timeout"));
    expect(await deliverDueEmails()).toBe(2);
    const [a, b] = await outbox();
    expect(a?.status).toBe("queued");
    expect(a?.attempts).toBe(1);
    expect(a?.lastError).toBe("SMTP timeout");
    expect(b?.status).toBe("sent");

    // Not due yet → nothing sent; once the back-off passes it goes out.
    expect(await deliverDueEmails()).toBe(0);
    await EmailOutboxModel.updateOne({ _id: a!._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
    expect(await deliverDueEmails()).toBe(1);
    expect((await EmailOutboxModel.findById(a!._id))?.status).toBe("sent");
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("builds a readable plain-text version", () => {
    const text = htmlToText(`<p>Hello <b>Asha</b></p><a href="https://x.test/a">Open</a><table><tr><td>Total</td><td>₹2,000</td></tr></table>`);
    expect(text).toBe("Hello Asha\nOpen (https://x.test/a)Total ₹2,000");
  });
});
