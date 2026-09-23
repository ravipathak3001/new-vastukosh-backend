import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { StoneModel } from "../src/modules/catalog/stone.model.js";
import { priceSegments } from "../src/modules/catalog/stone.service.js";
import { startTestDb, stopTestDb, resetDb } from "./helpers.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await resetDb();
  await StoneModel.create([
    { slug: "red-coral", name: { en: "Red Coral", hi: "मूंगा" }, grahas: ["Mars"], primary: true, pricePerBead: 150 },
    { slug: "carnelian", name: { en: "Carnelian", hi: "क" }, grahas: ["Mars"], primary: false, pricePerBead: 12 },
    { slug: "citrine", name: { en: "Citrine", hi: "स" }, grahas: ["Jupiter"], primary: false, pricePerBead: 15 },
    {
      slug: "hematite",
      name: { en: "Hematite", hi: "ह" },
      grahas: ["Mars", "Saturn"],
      primary: false,
      pricePerBead: 8,
      status: "archived",
    },
  ]);
});

describe("priceSegments", () => {
  it("sums beads × pricePerBead across segments, plus a base fee", async () => {
    const total = await priceSegments(
      [
        { graha: "Mars", stoneSlug: "carnelian", beads: 9 },
        { graha: "Jupiter", stoneSlug: "citrine", beads: 7 },
      ],
      50,
    );
    // 9*12 + 7*15 + 50 = 108 + 105 + 50
    expect(total).toBe(263);
  });

  it("prices a real-gem segment and a budget segment differently in the same bracelet", async () => {
    const budget = await priceSegments([{ graha: "Mars", stoneSlug: "carnelian", beads: 9 }]);
    const premium = await priceSegments([{ graha: "Mars", stoneSlug: "red-coral", beads: 9 }]);
    expect(premium).toBeGreaterThan(budget);
  });

  it("rejects a stone that doesn't exist", async () => {
    await expect(priceSegments([{ graha: "Mars", stoneSlug: "no-such-stone", beads: 9 }])).rejects.toThrow();
  });

  it("rejects an archived stone, even though the row exists", async () => {
    await expect(priceSegments([{ graha: "Mars", stoneSlug: "hematite", beads: 9 }])).rejects.toThrow();
  });

  it("rejects a stone that doesn't actually serve the segment's graha", async () => {
    // Carnelian is Mars-only — pricing it against a Jupiter segment should fail closed, not silently succeed.
    await expect(priceSegments([{ graha: "Jupiter", stoneSlug: "carnelian", beads: 7 }])).rejects.toThrow();
  });

  it("rejects an empty segment list", async () => {
    await expect(priceSegments([])).rejects.toThrow();
  });
});
