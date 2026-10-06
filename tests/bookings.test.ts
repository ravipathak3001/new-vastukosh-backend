import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { ALL_PERMISSION_KEYS } from "../src/modules/roles/permission-catalog.js";
import {
  ConsultationBookingModel,
  ConsultationServiceModel,
  PoojaServiceModel,
} from "../src/modules/consultation/consultation.model.js";
import {
  expireStaleHolds,
  markBookingFailed,
  markBookingPaid,
} from "../src/modules/consultation/consultation.service.js";
import { consultationServiceSeeds, poojaServiceSeeds } from "../src/db/seeds/misc.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await resetDb();
  await ConsultationServiceModel.insertMany(consultationServiceSeeds);
  await PoojaServiceModel.insertMany(poojaServiceSeeds);
});

const asAdmin = {
  authorization: `Bearer ${signAccessToken({
    sub: "000000000000000000000001",
    roles: ["admin"],
    permissions: ALL_PERMISSION_KEYS,
  })}`,
};

/** A date `offset`+ days out that falls on the wanted weekday (0 = Sunday). */
function futureDate(weekday: "sunday" | "weekday", offset = 3): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  while ((d.getUTCDay() === 0) !== (weekday === "sunday")) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const CREATE = `mutation ($input: CreateBookingInput!) {
  createBooking(input: $input) {
    accessToken clientData
    booking { id bookingNo kind status amount paymentStatus serviceName { en } meetingUrl }
  }
}`;

const BOOKING = `query ($no: String!, $t: String) {
  booking(bookingNo: $no, token: $t) {
    bookingNo status date slot meetingUrl recordingUrl proposedDate proposedSlot refundStatus
  }
}`;

function book(input: Record<string, unknown>) {
  return gql(CREATE, {
    input: { name: "Priya", email: "priya@test.com", phone: "9999999999", ...input },
  });
}

describe("creating bookings (mock payment provider)", () => {
  it("books and pays a consultation, holding the slot", async () => {
    const date = futureDate("weekday");
    const res = await book({ kind: "consultation", serviceKey: "astro", date, slot: "10:30" });
    expect(res.errors).toBeUndefined();
    const { booking, accessToken } = res.data.createBooking;
    expect(booking.bookingNo).toMatch(/^VB-/);
    expect(booking.status).toBe("requested");
    expect(booking.paymentStatus).toBe("captured");
    expect(booking.amount).toBe(1100);
    expect(booking.serviceName.en).toBe("Astro Consultancy");
    expect(booking.meetingUrl).toBeNull();
    expect(accessToken.length).toBeGreaterThan(10);

    const slots = await gql(`query ($d: String!) { availableSlots(date: $d) }`, { d: date });
    expect(slots.data.availableSlots).not.toContain("10:30");

    const again = await book({ kind: "consultation", serviceKey: "astro", date, slot: "10:30" });
    expect(again.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("only one of two simultaneous bookings for the same slot succeeds", async () => {
    const date = futureDate("weekday");
    const results = await Promise.all([
      book({ kind: "consultation", serviceKey: "vastu", date, slot: "15:00" }),
      book({ kind: "consultation", serviceKey: "gem", date, slot: "15:00" }),
    ]);
    expect(results.filter((r) => !r.errors)).toHaveLength(1);
    expect(await ConsultationBookingModel.countDocuments({ date, slot: "15:00" })).toBe(1);
  });

  it("poojas use their own slots and run on Sundays; consultations don't", async () => {
    const sunday = futureDate("sunday");
    const consult = await gql(`query ($d: String!) { availableSlots(date: $d) }`, { d: sunday });
    expect(consult.data.availableSlots).toEqual([]);
    const pooja = await gql(`query ($d: String!) { availableSlots(date: $d, kind: pooja) }`, {
      d: sunday,
    });
    expect(pooja.data.availableSlots).toContain("06:30");

    const res = await book({
      kind: "pooja",
      serviceKey: "rudrabhishek",
      date: sunday,
      slot: "06:30",
      sankalp: { gotra: "Kashyap", nakshatra: "Rohini", familyMembers: ["Amit", " ", "Riya"] },
    });
    expect(res.errors).toBeUndefined();
    expect(res.data.createBooking.booking.kind).toBe("pooja");
    expect(res.data.createBooking.booking.amount).toBe(2100);

    const stored = await ConsultationBookingModel.findOne({ kind: "pooja" });
    expect(stored!.sankalp!.familyMembers).toEqual(["Amit", "Riya"]);
  });

  it("rejects unknown poojas and consultation slots on pooja bookings", async () => {
    const date = futureDate("weekday");
    const unknown = await book({ kind: "pooja", serviceKey: "nope", date, slot: "06:30" });
    expect(unknown.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
    const wrongSlot = await book({ kind: "pooja", serviceKey: "ganesh-puja", date, slot: "10:30" });
    expect(wrongSlot.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("lets a guest see their booking only with its access token", async () => {
    const res = await book({
      kind: "consultation",
      serviceKey: "astro",
      date: futureDate("weekday"),
      slot: "11:30",
    });
    const { booking, accessToken } = res.data.createBooking;
    const ok = await gql(BOOKING, { no: booking.bookingNo, t: accessToken });
    expect(ok.data.booking.bookingNo).toBe(booking.bookingNo);
    expect((await gql(BOOKING, { no: booking.bookingNo })).data.booking).toBeNull();
    expect((await gql(BOOKING, { no: booking.bookingNo, t: "wrong" })).data.booking).toBeNull();
  });
});

describe("admin lifecycle", () => {
  async function paidBooking(kind: "consultation" | "pooja", slot: string) {
    const res = await book({
      kind,
      serviceKey: kind === "pooja" ? "lakshmi-puja" : "astro",
      date: futureDate("weekday"),
      slot,
    });
    return res.data.createBooking as {
      accessToken: string;
      booking: { id: string; bookingNo: string };
    };
  }

  it("confirming a consultation issues a meeting link", async () => {
    const { booking, accessToken } = await paidBooking("consultation", "09:30");
    const res = await gql(
      `mutation ($id: ID!) { confirmBooking(id: $id) { status meetingUrl } }`,
      { id: booking.id },
      asAdmin,
    );
    expect(res.data.confirmBooking.status).toBe("confirmed");
    expect(res.data.confirmBooking.meetingUrl).toMatch(/^https:\/\/meet\.jit\.si\//);

    const seen = await gql(BOOKING, { no: booking.bookingNo, t: accessToken });
    expect(seen.data.booking.meetingUrl).toBe(res.data.confirmBooking.meetingUrl);
  });

  it("a pooja gets no live link; completing it shares the recording", async () => {
    const { booking } = await paidBooking("pooja", "08:00");
    const confirmed = await gql(
      `mutation ($id: ID!) { confirmBooking(id: $id) { status meetingUrl } }`,
      { id: booking.id },
      asAdmin,
    );
    expect(confirmed.data.confirmBooking.meetingUrl).toBeNull();

    const bad = await gql(
      `mutation ($id: ID!) { completeBooking(id: $id, recordingUrl: "not a url") { status } }`,
      { id: booking.id },
      asAdmin,
    );
    expect(bad.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");

    const done = await gql(
      `mutation ($id: ID!, $u: String) { completeBooking(id: $id, recordingUrl: $u) { status recordingUrl } }`,
      { id: booking.id, u: "https://youtu.be/abc123" },
      asAdmin,
    );
    expect(done.data.completeBooking).toEqual({
      status: "completed",
      recordingUrl: "https://youtu.be/abc123",
    });
  });

  it("refuses to cancel a paid booking through the generic setter", async () => {
    const { booking } = await paidBooking("consultation", "12:30");
    const res = await gql(
      `mutation ($id: ID!) { updateBookingStatus(id: $id, status: cancelled) { status } }`,
      { id: booking.id },
      asAdmin,
    );
    expect(res.errors?.[0]?.message).toMatch(/refund/i);
  });

  describe("reschedule", () => {
    const PROPOSE = `mutation ($id: ID!, $d: String!, $s: String!) {
      proposeBookingReschedule(id: $id, date: $d, slot: $s, note: "Panditji travelling") { status proposedDate proposedSlot }
    }`;
    const RESPOND = `mutation ($no: String!, $t: String, $a: Boolean!) {
      respondToBookingReschedule(bookingNo: $no, token: $t, accept: $a) {
        status date slot meetingUrl refundStatus refundAmount proposedDate
      }
    }`;

    it("accepting moves and confirms the booking (with a meeting link)", async () => {
      const { booking, accessToken } = await paidBooking("consultation", "16:00");
      const newDate = futureDate("weekday", 10);
      const proposed = await gql(PROPOSE, { id: booking.id, d: newDate, s: "17:00" }, asAdmin);
      expect(proposed.data.proposeBookingReschedule.status).toBe("reschedule_proposed");

      // The proposed slot is held for this customer.
      const slots = await gql(`query ($d: String!) { availableSlots(date: $d) }`, { d: newDate });
      expect(slots.data.availableSlots).not.toContain("17:00");

      const noToken = await gql(RESPOND, { no: booking.bookingNo, a: true });
      expect(noToken.errors?.[0]?.extensions?.code).toBe("NOT_FOUND");

      const res = await gql(RESPOND, { no: booking.bookingNo, t: accessToken, a: true });
      expect(res.errors).toBeUndefined();
      expect(res.data.respondToBookingReschedule).toMatchObject({
        status: "confirmed",
        date: newDate,
        slot: "17:00",
        proposedDate: null,
      });
      expect(res.data.respondToBookingReschedule.meetingUrl).toBeTruthy();
    });

    it("declining refunds in full", async () => {
      const { booking, accessToken } = await paidBooking("consultation", "18:00");
      await gql(PROPOSE, { id: booking.id, d: futureDate("weekday", 12), s: "09:30" }, asAdmin);
      const res = await gql(RESPOND, { no: booking.bookingNo, t: accessToken, a: false });
      expect(res.data.respondToBookingReschedule).toMatchObject({
        status: "refunded",
        refundStatus: "processed",
        refundAmount: 1100,
      });

      // A second refund attempt is refused rather than paying out twice.
      const again = await gql(
        `mutation ($id: ID!) { refundBooking(id: $id) { status } }`,
        { id: booking.id },
        asAdmin,
      );
      expect(again.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
    });
  });
});

describe("gateway webhooks for bookings", () => {
  function seedPending(providerRef: string, holdExpiresAt = new Date(Date.now() + 10 * 60_000)) {
    return ConsultationBookingModel.create({
      bookingNo: "VB-TEST01",
      kind: "consultation",
      serviceKey: "astro",
      date: futureDate("weekday"),
      slot: "10:30",
      name: "Priya",
      email: "priya@test.com",
      status: "pending_payment",
      holdExpiresAt,
      amount: 1100,
      accessToken: "tok",
      payment: { provider: "razorpay", providerRef, status: "created" },
    });
  }

  it("is idempotent under concurrent capture delivery", async () => {
    await seedPending("order_bk1");
    const results = await Promise.all([
      markBookingPaid("order_bk1", "pay_1"),
      markBookingPaid("order_bk1", "pay_1"),
    ]);
    expect(results).toEqual([true, true]);
    const b = await ConsultationBookingModel.findOne({ bookingNo: "VB-TEST01" });
    expect(b!.status).toBe("requested");
    expect(b!.payment.transactionId).toBe("pay_1");
    expect(b!.history.filter((h) => h.status === "requested")).toHaveLength(1);
  });

  it("reports unknown refs as not-a-booking so the order handler can take them", async () => {
    expect(await markBookingPaid("order_unknown", "pay_x")).toBe(false);
    expect(await markBookingFailed("order_unknown")).toBe(false);
  });

  it("a declined attempt leaves the booking payable", async () => {
    await seedPending("order_bk2");
    expect(await markBookingFailed("order_bk2")).toBe(true);
    let b = await ConsultationBookingModel.findOne({ bookingNo: "VB-TEST01" });
    expect(b!.status).toBe("pending_payment");
    await markBookingPaid("order_bk2", "pay_2");
    b = await ConsultationBookingModel.findOne({ bookingNo: "VB-TEST01" });
    expect(b!.status).toBe("requested");
  });

  it("expired holds are released, but a late capture still revives the booking", async () => {
    await seedPending("order_bk3", new Date(Date.now() - 60 * 60_000));
    expect(await expireStaleHolds()).toBe(1);
    let b = await ConsultationBookingModel.findOne({ bookingNo: "VB-TEST01" });
    expect(b!.status).toBe("cancelled");

    await markBookingPaid("order_bk3", "pay_late");
    b = await ConsultationBookingModel.findOne({ bookingNo: "VB-TEST01" });
    expect(b!.status).toBe("requested");
    expect(b!.history.at(-1)!.note).toMatch(/hold expired/);
  });
});
