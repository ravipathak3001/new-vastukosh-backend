import { describe, expect, it } from "vitest";
import { computePanchanga } from "@vastukosh/panchang";
import { makeExecutor } from "./helpers.js";

/**
 * Guards the GraphQL mapping, not the astronomy — `@vastukosh/panchang` has its
 * own accuracy tests. We check that the resolver reaches the library, localises
 * the names to `{ en, hi }`, and returns the values the library produced.
 */
const gql = makeExecutor();

const QUERY = `
  query ($date: String, $lat: Float, $lng: Float) {
    panchang(date: $date, latitude: $lat, longitude: $lng, timezone: "Asia/Kolkata") {
      date
      location { latitude longitude place }
      vara { index name { en hi } start end }
      tithi { index name { en } start end }
      nakshatra { index name { en } pada lord }
      yoga { index name { en } }
      karana { index name { en } }
      paksha { en hi }
      masaAmanta { en }
      masaPurnimanta { en }
      ritu { en }
      sunrise
      sunset
      vikramSamvat
      shakaSamvat
      ayanamsa
      inauspiciousPeriods { name { en } start end quality }
      auspiciousPeriods { name { en } }
    }
  }
`;

const DELHI = { lat: 28.6139, lng: 77.209 };

describe("panchang query", () => {
  it("matches the library for 2024-04-08 (the eclipse new moon) at New Delhi", async () => {
    const res = await gql(QUERY, { date: "2024-04-08", ...DELHI });
    expect(res.errors).toBeUndefined();
    const p = res.data.panchang;

    const lib = computePanchanga({
      date: new Date("2024-04-08T12:00:00Z"),
      latitude: DELHI.lat,
      longitude: DELHI.lng,
      timezone: "Asia/Kolkata",
    });

    expect(p.date).toBe("2024-04-08");
    expect(p.vara.name.en).toBe("Somavara");
    expect(p.vara.name.hi).toBe(lib.vara.name.devanagari);
    expect(p.tithi.index).toBe(30);
    expect(p.tithi.name.en).toBe("Amavasya");
    expect(p.paksha.en).toBe("Krishna Paksha");
    expect(p.masaAmanta.en).toBe("Phalguna");
    expect(p.masaPurnimanta.en).toBe("Chaitra");

    expect(p.nakshatra.index).toBe(lib.nakshatra.index);
    expect(p.nakshatra.pada).toBe(lib.nakshatra.pada);
    expect(p.nakshatra.lord).toBe(lib.nakshatra.lord);
    expect(new Date(p.tithi.end).getTime()).toBe(lib.tithi.end.getTime());
    expect(new Date(p.sunrise).getTime()).toBe(lib.sunrise.getTime());
    expect(p.ayanamsa).toBeCloseTo(lib.ayanamsa, 6);
  });

  it("names the three inauspicious kaalas and keeps them inside the day", async () => {
    const res = await gql(QUERY, { date: "2024-04-08", ...DELHI });
    const p = res.data.panchang;
    expect(p.inauspiciousPeriods.map((k: { name: { en: string } }) => k.name.en)).toEqual([
      "Rahu Kala",
      "Yamaganda",
      "Gulika Kala",
    ]);
    for (const k of p.inauspiciousPeriods) {
      expect(k.quality).toBe("inauspicious");
      expect(new Date(k.start).getTime()).toBeGreaterThanOrEqual(new Date(p.sunrise).getTime());
      expect(new Date(k.end).getTime()).toBeLessThanOrEqual(new Date(p.sunset).getTime() + 1000);
    }
  });

  it("falls back to the configured default location when no coords are given", async () => {
    const res = await gql(QUERY, { date: "2024-04-08" });
    expect(res.errors).toBeUndefined();
    const p = res.data.panchang;
    expect(p.location.latitude).toBeCloseTo(28.6139, 3);
    expect(p.location.place).toBe("New Delhi, India");
  });

  it("rejects a malformed date", async () => {
    const res = await gql(QUERY, { date: "08-04-2024", ...DELHI });
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });
});
