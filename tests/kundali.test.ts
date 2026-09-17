import { describe, expect, it } from "vitest";
import { generateKundali, vimshottariDasha, activeDashaChain, GRAHA_ORDER } from "vedic-kundali";
import { makeExecutor } from "./helpers.js";

/**
 * Guards the GraphQL mapping and the friend/enemy synthesis, not the
 * underlying astronomy — `vedic-kundali`/`vedic-panchanga` have their own
 * accuracy tests. We check that the resolver reaches the library and returns
 * the same chart/dasha the library itself produces, and that the compound
 * friendship + gemstone matching is internally consistent.
 */
const gql = makeExecutor();

const QUERY = `
  query ($date: String!, $time: String!, $lat: Float!, $lng: Float!) {
    kundaliRecommendation(date: $date, time: $time, latitude: $lat, longitude: $lng, timezone: "Asia/Kolkata") {
      ascendant { rashi rashiName { en } lord lordName { en } }
      moonSign { rashi rashiName { en } lord }
      nakshatra { name { en } pada }
      currentMahadasha { lord lordName { en } start end antardashaLord antardashaStart antardashaEnd }
      planetRelations { planet planetName { en } gemstone { en hi } relationToLagnaLord relationToMahadashaLord }
      favorablePlanets { planet }
      cautionPlanets { planet }
      houses { house rashi rashiName { en } grahas }
      chandraHouses { house rashi rashiName { en } grahas }
    }
  }
`;

const DELHI = { lat: 28.6139, lng: 77.209 };
const BIRTH = { date: "1990-06-15", time: "14:30", ...DELHI };

describe("kundaliRecommendation query", () => {
  it("matches the library's chart and current Mahādaśā", async () => {
    const res = await gql(QUERY, BIRTH);
    expect(res.errors).toBeUndefined();
    const r = res.data.kundaliRecommendation;

    const k = generateKundali({
      date: BIRTH.date,
      time: BIRTH.time,
      latitude: BIRTH.lat,
      longitude: BIRTH.lng,
      timezone: "Asia/Kolkata",
    });
    const dasha = vimshottariDasha(k);
    const chain = activeDashaChain(dasha.mahadashas);

    expect(r.ascendant.rashi).toBe(k.ascendant.rashi);
    expect(r.ascendant.rashiName.en).toBe(k.ascendant.rashiName.iast);
    expect(r.moonSign.rashi).toBe(k.moonSign);
    expect(r.nakshatra.name.en).toBe(k.nakshatra.name.iast);
    expect(r.nakshatra.pada).toBe(k.nakshatra.pada);
    expect(r.currentMahadasha.lord).toBe(chain[0]?.lord);
    expect(new Date(r.currentMahadasha.start).getTime()).toBe(chain[0]?.start.getTime());
    expect(new Date(r.currentMahadasha.end).getTime()).toBe(chain[0]?.end.getTime());
    expect(r.currentMahadasha.antardashaLord).toBe(chain[1]?.lord ?? null);
  });

  it("relates all nine grahas to both the Lagna lord and the Mahādaśā lord", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;

    expect(r.planetRelations).toHaveLength(9);
    expect(r.planetRelations.map((p: { planet: string }) => p.planet).sort()).toEqual(
      [...GRAHA_ORDER].sort(),
    );

    const relations = new Set(["GREAT_FRIEND", "FRIEND", "NEUTRAL", "ENEMY", "GREAT_ENEMY", "SELF"]);
    for (const p of r.planetRelations) {
      expect(relations.has(p.relationToLagnaLord)).toBe(true);
      expect(relations.has(p.relationToMahadashaLord)).toBe(true);
    }

    const selfToLagna = r.planetRelations.find(
      (p: { relationToLagnaLord: string }) => p.relationToLagnaLord === "SELF",
    );
    expect(selfToLagna.planet).toBe(r.ascendant.lord);

    const selfToMaha = r.planetRelations.find(
      (p: { relationToMahadashaLord: string }) => p.relationToMahadashaLord === "SELF",
    );
    expect(selfToMaha.planet).toBe(r.currentMahadasha.lord);
  });

  it("places every graha in exactly one of the 12 houses, matching the library's chart", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;

    const k = generateKundali({
      date: BIRTH.date,
      time: BIRTH.time,
      latitude: BIRTH.lat,
      longitude: BIRTH.lng,
      timezone: "Asia/Kolkata",
    });

    expect(r.houses).toHaveLength(12);
    expect(r.houses.map((h: { house: number }) => h.house).sort((a: number, b: number) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    expect(r.houses[0].house).toBe(1);
    expect(r.houses[0].rashi).toBe(r.ascendant.rashi);

    const allPlacedGrahas = r.houses.flatMap((h: { grahas: string[] }) => h.grahas);
    expect(allPlacedGrahas.sort()).toEqual([...GRAHA_ORDER].sort());

    for (const bhava of k.houses) {
      const match = r.houses.find((h: { house: number }) => h.house === bhava.house);
      expect(match.rashi).toBe(bhava.rashi);
      expect(match.grahas.sort()).toEqual([...bhava.grahas].sort());
    }
  });

  it("chandraHouses matches the library's Chandra Kuṇḍalī, with the Moon's own rashi at house 1", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;

    const k = generateKundali({
      date: BIRTH.date,
      time: BIRTH.time,
      latitude: BIRTH.lat,
      longitude: BIRTH.lng,
      timezone: "Asia/Kolkata",
    });

    expect(r.chandraHouses).toHaveLength(12);
    expect(r.chandraHouses[0].house).toBe(1);
    expect(r.chandraHouses[0].rashi).toBe(r.moonSign.rashi);
    expect(r.chandraHouses[0].grahas).toContain("Moon");

    for (const bhava of k.chandraKundaliHouses) {
      const match = r.chandraHouses.find((h: { house: number }) => h.house === bhava.house);
      expect(match.rashi).toBe(bhava.rashi);
      expect(match.grahas.sort()).toEqual([...bhava.grahas].sort());
    }
  });

  it("keeps favorablePlanets and cautionPlanets disjoint", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;
    const favorable = new Set(r.favorablePlanets.map((p: { planet: string }) => p.planet));
    const caution = new Set(r.cautionPlanets.map((p: { planet: string }) => p.planet));
    for (const p of favorable) expect(caution.has(p)).toBe(false);
  });

  it("rejects a malformed birth date", async () => {
    const res = await gql(QUERY, { ...BIRTH, date: "15-06-1990" });
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("rejects a malformed birth time", async () => {
    const res = await gql(QUERY, { ...BIRTH, time: "2:30 pm" });
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });

  it("rejects an out-of-range latitude", async () => {
    const res = await gql(QUERY, { ...BIRTH, lat: 132 });
    expect(res.errors?.[0]?.extensions?.code).toBe("BAD_INPUT");
  });
});
