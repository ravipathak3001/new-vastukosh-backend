import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { ALL_PERMISSION_KEYS } from "../src/modules/roles/permission-catalog.js";
import { ConsultationServiceModel } from "../src/modules/consultation/consultation.model.js";
import { consultationServiceSeeds } from "../src/db/seeds/misc.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const gql = makeExecutor();
beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await resetDb();
  await ConsultationServiceModel.insertMany(consultationServiceSeeds);
});

const asAdmin = {
  authorization: `Bearer ${signAccessToken({
    sub: "000000000000000000000001",
    roles: ["admin"],
    permissions: ALL_PERMISSION_KEYS,
  })}`,
};

function futureWeekday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe("admin-managed booking catalogs", () => {
  it("updating a consultation fee changes the listed and the charged price", async () => {
    const up = await gql(
      `mutation { upsertConsultationService(input: { key: vastu, price: 2500, durationMins: 75 }) { key price durationMins name { en } } }`,
      undefined,
      asAdmin,
    );
    expect(up.errors).toBeUndefined();
    expect(up.data.upsertConsultationService).toMatchObject({
      price: 2500,
      durationMins: 75,
      name: { en: "Vastu Shastra" }, // untouched fields survive a partial update
    });

    const list = await gql(`{ consultationServices { key price } }`);
    expect(list.data.consultationServices.find((s: any) => s.key === "vastu").price).toBe(2500);

    const booked = await gql(
      `mutation ($i: CreateBookingInput!) { createBooking(input: $i) { booking { amount } } }`,
      { i: { kind: "consultation", serviceKey: "vastu", date: futureWeekday(), slot: "10:30", name: "A", email: "a@b.co" } },
    );
    expect(booked.data.createBooking.booking.amount).toBe(2500);
  });

  it("rejects a negative fee and is admin-only", async () => {
    const bad = await gql(
      `mutation { upsertConsultationService(input: { key: astro, price: -5 }) { price } }`,
      undefined,
      asAdmin,
    );
    expect(bad.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");

    const anon = await gql(`mutation { upsertConsultationService(input: { key: astro, price: 1 }) { price } }`);
    expect(anon.errors).toBeDefined();
  });

  it("hiding a service removes it from the site and blocks booking it", async () => {
    await gql(`mutation { upsertConsultationService(input: { key: gem, active: false }) { key } }`, undefined, asAdmin);
    const list = await gql(`{ consultationServices { key } }`);
    expect(list.data.consultationServices.map((s: any) => s.key)).not.toContain("gem");
    const booked = await gql(
      `mutation ($i: CreateBookingInput!) { createBooking(input: $i) { booking { amount } } }`,
      { i: { kind: "consultation", serviceKey: "gem", date: futureWeekday(), slot: "11:30", name: "A", email: "a@b.co" } },
    );
    expect(booked.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("admins can create and re-price a pooja", async () => {
    const created = await gql(
      `mutation { upsertPoojaService(input: { slug: "durga-saptashati", name: { en: "Durga Saptashati", hi: "दुर्गा सप्तशती" }, description: { en: "Path", hi: "पाठ" }, price: 3100, durationMins: 150 }) { slug } }`,
      undefined,
      asAdmin,
    );
    expect(created.errors).toBeUndefined();
    await gql(`mutation { upsertPoojaService(input: { slug: "durga-saptashati", price: 3500 }) { slug } }`, undefined, asAdmin);
    const list = await gql(`{ poojaServices { slug price name { hi } } }`);
    expect(list.data.poojaServices).toEqual([
      { slug: "durga-saptashati", price: 3500, name: { hi: "दुर्गा सप्तशती" } },
    ]);
  });
});
