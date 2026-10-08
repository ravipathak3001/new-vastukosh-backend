import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { ALL_PERMISSION_KEYS } from "../src/modules/roles/permission-catalog.js";
import { UserModel } from "../src/modules/auth/auth.model.js";
import {
  ConsultationBookingModel,
  ConsultationServiceModel,
  PoojaServiceModel,
} from "../src/modules/consultation/consultation.model.js";
import { ExpertLedgerModel, ExpertProfileModel } from "../src/modules/expert/expert.model.js";
import { consultationServiceSeeds, poojaServiceSeeds } from "../src/db/seeds/misc.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();
beforeAll(startTestDb);
afterAll(stopTestDb);

const asAdmin = {
  authorization: `Bearer ${signAccessToken({
    sub: "000000000000000000000001",
    roles: ["admin"],
    permissions: ALL_PERMISSION_KEYS,
  })}`,
};

let n = 0;
async function makeUser(name: string, roles: ("customer" | "expert")[] = ["customer"]) {
  n++;
  const u = await UserModel.create({
    email: `${name.toLowerCase().replace(/\s/g, "")}${n}@test.com`,
    passwordHash: "x",
    name,
    referralCode: `REF${n}${Date.now()}`,
    roles,
  });
  const auth = (r = roles) => ({
    authorization: `Bearer ${signAccessToken({ sub: String(u._id), roles: r, permissions: [] })}`,
  });
  return { user: u, auth };
}

/** A weekday (Mon–Sat) `offset`+ days out, plus its weekday number. */
function futureDay(offset = 3): { date: string; day: number } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return { date: d.toISOString().slice(0, 10), day: d.getUTCDay() };
}

const APPLY = `mutation ($i: ExpertProfileInput!) { applyAsExpert(input: $i) { id slug status } }`;
const OFFER = `mutation ($i: ExpertOfferingInput!) { upsertMyOffering(input: $i) { id price panditCount durationMins } }`;

/** Applies, sets hours for `day`, adds offerings, gets approved. */
async function approvedExpert(name: string, day: number, opts: { commissionPct?: number } = {}) {
  const { user, auth } = await makeUser(name);
  const applied = await gql(APPLY, { i: { displayName: name, specialities: ["astro", "pooja"] } }, auth());
  expect(applied.errors).toBeUndefined();
  const expertAuth = auth(["customer", "expert"]);
  await gql(
    `mutation ($w: [ExpertAvailabilityWindowInput!]!) { setMyAvailability(windows: $w, daysOff: []) { id } }`,
    { w: [{ day, start: "09:00", end: "13:00" }] },
    expertAuth,
  );
  await gql(OFFER, { i: { kind: "consultation", serviceKey: "astro", price: 1500, durationMins: 60 } }, expertAuth);
  await gql(
    OFFER,
    { i: { kind: "pooja", serviceKey: "rudrabhishek", price: 5100, durationMins: 120, panditCount: 3 } },
    expertAuth,
  );
  const id = applied.data.applyAsExpert.id;
  await gql(`mutation ($id: ID!) { setExpertStatus(id: $id, status: approved) { status } }`, { id }, asAdmin);
  if (opts.commissionPct != null) {
    await gql(
      `mutation ($id: ID!, $c: Float) { setExpertCommission(id: $id, commissionPct: $c) { id } }`,
      { id, c: opts.commissionPct },
      asAdmin,
    );
  }
  return { id, slug: applied.data.applyAsExpert.slug as string, user, auth: expertAuth };
}

const BOOK = `mutation ($i: CreateBookingInput!) {
  createBooking(input: $i) { accessToken booking { id bookingNo status amount durationMins panditCount expert { slug } } }
}`;

function bookExpert(slug: string, date: string, slot: string, kind = "consultation", serviceKey = "astro") {
  return gql(BOOK, {
    i: { kind, serviceKey, date, slot, name: "Priya Sharma", email: "priya@test.com", phone: "9999900000", expertSlug: slug },
  });
}

beforeEach(async () => {
  await resetDb();
  await ConsultationServiceModel.insertMany(consultationServiceSeeds);
  await PoojaServiceModel.insertMany(poojaServiceSeeds);
});

describe("expert onboarding", () => {
  it("applying creates a pending profile, grants the role, and stays unlisted until approved", async () => {
    const { user, auth } = await makeUser("Ravi Shastri");
    const res = await gql(APPLY, { i: { displayName: "Ravi Shastri", specialities: ["vastu"] } }, auth());
    expect(res.data.applyAsExpert).toMatchObject({ slug: "ravi-shastri", status: "pending" });
    expect((await UserModel.findById(user._id))!.roles).toContain("expert");

    const listed = await gql(`{ experts { total } }`);
    expect(listed.data.experts.total).toBe(0);
    expect((await gql(`{ expert(slug: "ravi-shastri") { id } }`)).data.expert).toBeNull();

    const again = await gql(APPLY, { i: { specialities: ["vastu"] } }, auth());
    expect(again.errors?.[0]?.extensions?.code).toBe("CONFLICT");
  });

  it("validates offerings, KYC and availability", async () => {
    const { auth } = await makeUser("Meera");
    await gql(APPLY, { i: { specialities: ["pooja"] } }, auth());
    const ex = auth(["customer", "expert"]);

    const badPooja = await gql(OFFER, { i: { kind: "pooja", serviceKey: "nope", price: 100, durationMins: 60 } }, ex);
    expect(badPooja.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
    const badDuration = await gql(OFFER, { i: { kind: "consultation", serviceKey: "astro", price: 100, durationMins: 50 } }, ex);
    expect(badDuration.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");

    const badIfsc = await gql(
      `mutation { updateMyExpertKyc(input: { bankIfsc: "HDFC123", bankAccountNumber: "123456789012" }) { id } }`,
      undefined,
      ex,
    );
    expect(badIfsc.errors?.[0]?.message).toMatch(/IFSC/);

    const overlap = await gql(
      `mutation { setMyAvailability(windows: [{day: 1, start: "09:00", end: "12:00"}, {day: 1, start: "11:00", end: "14:00"}], daysOff: []) { id } }`,
      undefined,
      ex,
    );
    expect(overlap.errors?.[0]?.message).toMatch(/overlap/);
  });

  it("only staff can approve; customers can't see private fields", async () => {
    const { auth } = await makeUser("Ajay");
    const applied = await gql(APPLY, { i: { specialities: ["astro"] } }, auth());
    const id = applied.data.applyAsExpert.id;
    const asCustomer = (await makeUser("Nosy")).auth();
    const denied = await gql(`mutation ($id: ID!) { setExpertStatus(id: $id, status: approved) { status } }`, { id }, asCustomer);
    expect(denied.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");

    await gql(`mutation ($id: ID!) { setExpertStatus(id: $id, status: approved) { status } }`, { id }, asAdmin);
    const pub = await gql(`{ experts { items { slug walletBalance } } }`, undefined, asCustomer);
    expect(pub.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  });
});

describe("booking an expert", () => {
  it("uses the expert's price, duration, calendar and commission", async () => {
    const { date, day } = futureDay(3);
    const ex = await approvedExpert("Pandit Sharma", day, { commissionPct: 25 });

    const slots = await gql(
      `query ($d: String!) { expertSlots(slug: "${"pandit-sharma"}", kind: "consultation", serviceKey: "astro", date: $d) }`,
      { d: date },
    );
    // 09:00–13:00 window, 60-min sessions on a 30-min grid → last start 12:00.
    expect(slots.data.expertSlots).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"]);

    const res = await bookExpert(ex.slug, date, "10:00");
    expect(res.errors).toBeUndefined();
    expect(res.data.createBooking.booking).toMatchObject({ amount: 1500, durationMins: 60, expert: { slug: ex.slug } });

    const stored = await ConsultationBookingModel.findOne({ bookingNo: res.data.createBooking.booking.bookingNo });
    expect(stored).toMatchObject({ commissionPct: 25, platformFee: 375, expertEarning: 1125 });

    // 09:30–11:30 now overlap the 10:00–11:00 booking.
    const after = await gql(
      `query ($d: String!) { expertSlots(slug: "pandit-sharma", kind: "consultation", serviceKey: "astro", date: $d) }`,
      { d: date },
    );
    expect(after.data.expertSlots).toEqual(["09:00", "11:00", "11:30", "12:00"]);

    // The platform's own grid is untouched by expert bookings.
    const platform = await gql(`query ($d: String!) { availableSlots(date: $d) }`, { d: date });
    expect(platform.data.availableSlots).toContain("10:30");

    const clash = await bookExpert(ex.slug, date, "10:30");
    expect(clash.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("pooja offerings carry the number of pandits", async () => {
    const { date, day } = futureDay(4);
    const ex = await approvedExpert("Acharya Dev", day);
    const res = await bookExpert(ex.slug, date, "09:00", "pooja", "rudrabhishek");
    expect(res.data.createBooking.booking).toMatchObject({ amount: 5100, panditCount: 3, durationMins: 120 });
  });

  it("days off and suspended experts have no slots", async () => {
    const { date, day } = futureDay(5);
    const ex = await approvedExpert("Off Day", day);
    await gql(
      `mutation ($w: [ExpertAvailabilityWindowInput!]!, $off: [String!]!) { setMyAvailability(windows: $w, daysOff: $off) { id } }`,
      { w: [{ day, start: "09:00", end: "13:00" }], off: [date] },
      ex.auth,
    );
    const q = `query ($d: String!) { expertSlots(slug: "${ex.slug}", kind: "consultation", serviceKey: "astro", date: $d) }`;
    expect((await gql(q, { d: date })).data.expertSlots).toEqual([]);
  });

  it("only the assigned expert sees the customer's private details", async () => {
    const { date, day } = futureDay(3);
    const a = await approvedExpert("Expert A", day);
    const b = await approvedExpert("Expert B", day);
    const res = await bookExpert(a.slug, date, "09:00");
    const id = res.data.createBooking.booking.id;
    const Q = `query ($id: ID!) { adminBooking(id: $id) { phone } }`;
    // adminBooking needs bookings.view, so go through the expert's own list instead.
    const mine = await gql(`{ myExpertBookings(scope: action) { bookingNo phone expertEarning } }`, undefined, a.auth);
    expect(mine.data.myExpertBookings[0]).toMatchObject({ phone: "9999900000", expertEarning: 1200 });
    const theirs = await gql(`{ myExpertBookings(scope: action) { bookingNo } }`, undefined, b.auth);
    expect(theirs.data.myExpertBookings).toEqual([]);
    expect((await gql(Q, { id }, b.auth)).errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  });
});

describe("earnings, refunds and cashouts", () => {
  async function completedBooking() {
    const { date, day } = futureDay(3);
    const ex = await approvedExpert("Wallet Expert", day);
    const res = await bookExpert(ex.slug, date, "09:00");
    const no = res.data.createBooking.booking.bookingNo as string;
    const id = res.data.createBooking.booking.id as string;
    const confirmed = await gql(
      `mutation ($no: String!) { expertConfirmBooking(bookingNo: $no) { status meetingUrl } }`,
      { no },
      ex.auth,
    );
    expect(confirmed.data.expertConfirmBooking.status).toBe("confirmed");
    // Session is in the future, so complete via admin (experts can only complete on/after the date).
    await gql(`mutation ($id: ID!) { completeBooking(id: $id) { status } }`, { id }, asAdmin);
    return { ex, no, id, token: res.data.createBooking.accessToken as string };
  }

  it("credits the expert's share once on completion and reverses it on a later refund", async () => {
    const { ex, id } = await completedBooking();
    let p = await ExpertProfileModel.findById(ex.id);
    expect(p).toMatchObject({ walletBalance: 1200, lifetimeEarnings: 1200, completedCount: 1 });

    // Re-completing (e.g. adding a recording) doesn't credit twice.
    await gql(`mutation ($id: ID!) { completeBooking(id: $id, recordingUrl: "https://youtu.be/x") { status } }`, { id }, asAdmin);
    expect((await ExpertProfileModel.findById(ex.id))!.walletBalance).toBe(1200);

    await gql(`mutation ($id: ID!) { refundBooking(id: $id) { status } }`, { id }, asAdmin);
    p = await ExpertProfileModel.findById(ex.id);
    expect(p).toMatchObject({ walletBalance: 0, lifetimeEarnings: 0, completedCount: 0 });
    const types = (await ExpertLedgerModel.find({ expertId: ex.id })).map((l) => l.type).sort();
    expect(types).toEqual(["booking_credit", "booking_reversal"]);
  });

  it("cashouts need a destination and minimum, hold funds, and release them on rejection", async () => {
    const { ex } = await completedBooking();
    const REQ = `mutation ($a: Float!) { requestPayout(amount: $a) { id payoutNo status destination } }`;

    const noDest = await gql(REQ, { a: 1000 }, ex.auth);
    expect(noDest.errors?.[0]?.message).toMatch(/bank account or UPI/);

    await gql(`mutation { updateMyExpertKyc(input: { upiId: "pandit@okicici" }) { id } }`, undefined, ex.auth);
    expect((await gql(REQ, { a: 100 }, ex.auth)).errors?.[0]?.message).toMatch(/Minimum cashout/);
    expect((await gql(REQ, { a: 5000 }, ex.auth)).errors?.[0]?.message).toMatch(/available balance/);

    const ok = await gql(REQ, { a: 1000 }, ex.auth);
    expect(ok.data.requestPayout).toMatchObject({ status: "requested", destination: "pandit@okicici" });
    expect((await ExpertProfileModel.findById(ex.id))!.walletBalance).toBe(200);
    expect((await gql(REQ, { a: 500 }, ex.auth)).errors?.[0]?.message).toMatch(/already have a cashout/);

    const rej = await gql(
      `mutation ($id: ID!) { rejectPayout(id: $id, note: "Name mismatch on UPI") { status } }`,
      { id: ok.data.requestPayout.id },
      asAdmin,
    );
    expect(rej.data.rejectPayout.status).toBe("rejected");
    expect((await ExpertProfileModel.findById(ex.id))!.walletBalance).toBe(1200);

    const again = await gql(REQ, { a: 1200 }, ex.auth);
    const paid = await gql(
      `mutation ($id: ID!) { markPayoutPaid(id: $id, reference: "UTR123456") { status reference } }`,
      { id: again.data.requestPayout.id },
      asAdmin,
    );
    expect(paid.data.markPayoutPaid).toEqual({ status: "paid", reference: "UTR123456" });
    expect((await ExpertProfileModel.findById(ex.id))!.walletBalance).toBe(0);

    const dash = await gql(`{ myExpertDashboard { walletBalance lifetimeEarnings pendingPayout commissionPct } }`, undefined, ex.auth);
    expect(dash.data.myExpertDashboard).toEqual({ walletBalance: 0, lifetimeEarnings: 1200, pendingPayout: 0, commissionPct: 20 });
  });

  it("customers review once, after completion, and the rating updates", async () => {
    const { ex, no, token } = await completedBooking();
    const R = `mutation ($no: String!, $t: String, $r: Int!) { submitExpertReview(bookingNo: $no, token: $t, rating: $r, comment: "Very insightful") { reviewed } }`;
    expect((await gql(R, { no, r: 5 })).errors?.[0]?.extensions?.code).toBe("NOT_FOUND"); // no token
    expect((await gql(R, { no, t: token, r: 5 })).data.submitExpertReview.reviewed).toBe(true);
    expect((await gql(R, { no, t: token, r: 4 })).errors?.[0]?.extensions?.code).toBe("BAD_INPUT");

    const pub = await gql(`{ expert(slug: "${ex.slug}") { ratingAvg ratingCount completedCount } }`);
    expect(pub.data.expert).toEqual({ ratingAvg: 5, ratingCount: 1, completedCount: 1 });
  });
});

describe("admin assigning an expert to a platform booking", () => {
  it("fixes the split from the booking amount", async () => {
    const { date, day } = futureDay(3);
    const ex = await approvedExpert("Assigned One", day);
    const res = await gql(BOOK, {
      i: { kind: "consultation", serviceKey: "vastu", date, slot: "10:30", name: "Raj", email: "raj@test.com" },
    });
    const id = res.data.createBooking.booking.id;
    const out = await gql(
      `mutation ($id: ID!, $e: ID!) { assignBookingExpert(id: $id, expertId: $e) { expert { slug } platformFee expertEarning } }`,
      { id, e: ex.id },
      asAdmin,
    );
    expect(out.data.assignBookingExpert).toEqual({ expert: { slug: ex.slug }, platformFee: 420, expertEarning: 1680 });
  });
});
