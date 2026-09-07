import { describe, expect, it } from "vitest";
import { computePanchanga } from "vedic-panchanga";
import { makeExecutor } from "./helpers.js";

/**
 * Guards the GraphQL mapping, not the astronomy — `vedic-panchanga` has its
 * own accuracy tests. We check that the resolver reaches the library, localises
 * the names to `{ en, hi }`, and returns the values the library produced.
 */
const gql = makeExecutor();

const QUERY = `
  query ($date: String, $time: String, $lat: Float, $lng: Float) {
    panchang(date: $date, time: $time, latitude: $lat, longitude: $lng, timezone: "Asia/Kolkata") {
      date
      reference { kind instant }
      currentPeriods { name { en } start end quality }
      location { latitude longitude place }
      vara { index name { en hi } start end }
      tithi { index name { en } start end fractionElapsed }
      nakshatra { index name { en } start end pada lord }
      yoga { index name { en } start end }
      karana { index name { en } start end }
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

  it("without `time`, evaluates at sunrise", async () => {
    const res = await gql(QUERY, { date: "2024-04-08", ...DELHI });
    const p = res.data.panchang;
    expect(p.reference.kind).toBe("sunrise");
    expect(new Date(p.reference.instant).getTime()).toBe(new Date(p.sunrise).getTime());
    expect(p.currentPeriods).toEqual([]);
  });

  it("with `time`, measures the aṅgas at that wall-clock instant", async () => {
    const res = await gql(QUERY, { date: "2024-04-08", time: "14:30", ...DELHI });
    expect(res.errors).toBeUndefined();
    const p = res.data.panchang;

    const lib = computePanchanga({
      date: new Date("2024-04-08T12:00:00Z"),
      time: "14:30",
      latitude: DELHI.lat,
      longitude: DELHI.lng,
      timezone: "Asia/Kolkata",
    });

    expect(p.reference.kind).toBe("time");
    expect(new Date(p.reference.instant).getTime()).toBe(lib.reference.instant.getTime());
    expect(p.tithi.index).toBe(lib.tithi.index);
    expect(p.tithi.fractionElapsed).toBeCloseTo(lib.tithi.fractionElapsed, 6);
    expect(p.currentPeriods.map((k: { name: { en: string } }) => k.name.en)).toEqual(
      lib.currentPeriods.map((k) => k.name.iast),
    );
    for (const k of p.currentPeriods) {
      const t = new Date(p.reference.instant).getTime();
      expect(new Date(k.start).getTime()).toBeLessThanOrEqual(t);
      expect(new Date(k.end).getTime()).toBeGreaterThanOrEqual(t);
    }
  });

  it("rejects a malformed time", async () => {
    const res = await gql(QUERY, { date: "2024-04-08", time: "2:30 pm", ...DELHI });
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
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

const TIMELINE_QUERY = `
  query ($date: String, $lat: Float, $lng: Float) {
    panchangTimeline(date: $date, latitude: $lat, longitude: $lng, timezone: "Asia/Kolkata") {
      date
      sunrise
      sunset
      nextSunrise
      vara { en }
      tithiSegments { index name { en } start end }
      nakshatraSegments { index name { en } start end }
      yogaSegments { index name { en } start end }
      karanaSegments { index name { en } start end }
      auspiciousPeriods { name { en } }
      inauspiciousPeriods { name { en } }
    }
  }
`;

type Segment = { index: number; name: { en: string }; start: string; end: string };

/**
 * Every segment list must fully tile [sunrise, nextSunrise] with no gaps or
 * overlaps. Each boundary is computed twice — once as the end of one segment,
 * once as the start of the next, from different probe instants — so allow the
 * astronomical solver's own convergence jitter (sub-second) rather than
 * requiring bit-for-bit equality.
 */
function assertContiguousCoverage(segments: Segment[], nextSunrise: number) {
  expect(segments.length).toBeGreaterThan(0);
  for (let i = 1; i < segments.length; i++) {
    const gap = Math.abs(
      new Date(segments[i]!.start).getTime() - new Date(segments[i - 1]!.end).getTime(),
    );
    expect(gap).toBeLessThan(5000);
  }
  expect(new Date(segments[segments.length - 1]!.end).getTime()).toBeGreaterThanOrEqual(nextSunrise);
}

describe("panchangTimeline query", () => {
  it("covers the full sunrise-to-next-sunrise day for every anga, contiguously", async () => {
    const res = await gql(TIMELINE_QUERY, { date: "2024-04-08", ...DELHI });
    expect(res.errors).toBeUndefined();
    const p = res.data.panchangTimeline;
    const nextSunrise = new Date(p.nextSunrise).getTime();

    assertContiguousCoverage(p.tithiSegments, nextSunrise);
    assertContiguousCoverage(p.nakshatraSegments, nextSunrise);
    assertContiguousCoverage(p.yogaSegments, nextSunrise);
    assertContiguousCoverage(p.karanaSegments, nextSunrise);

    // karana is half a tithi, so it can never change less often than tithi does.
    expect(p.karanaSegments.length).toBeGreaterThanOrEqual(p.tithiSegments.length);
  });

  it("the first segment of each anga matches `panchang`'s sunrise snapshot", async () => {
    const [timelineRes, snapshotRes] = await Promise.all([
      gql(TIMELINE_QUERY, { date: "2024-04-08", ...DELHI }),
      gql(QUERY, { date: "2024-04-08", ...DELHI }),
    ]);
    const timeline = timelineRes.data.panchangTimeline;
    const snapshot = snapshotRes.data.panchang;

    for (const anga of ["tithi", "nakshatra", "yoga", "karana"] as const) {
      const first = timeline[`${anga}Segments`][0];
      expect(first.index).toBe(snapshot[anga].index);
      expect(first.name.en).toBe(snapshot[anga].name.en);
      expect(new Date(first.start).getTime()).toBe(new Date(snapshot[anga].start).getTime());
      expect(new Date(first.end).getTime()).toBe(new Date(snapshot[anga].end).getTime());
    }
    expect(timeline.inauspiciousPeriods.map((k: { name: { en: string } }) => k.name.en)).toEqual(
      snapshot.inauspiciousPeriods.map((k: { name: { en: string } }) => k.name.en),
    );
  });

  it("falls back to the configured default location when no coords are given", async () => {
    const res = await gql(TIMELINE_QUERY, { date: "2024-04-08" });
    expect(res.errors).toBeUndefined();
    expect(res.data.panchangTimeline.tithiSegments.length).toBeGreaterThan(0);
  });
});
