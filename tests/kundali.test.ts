import { describe, expect, it } from "vitest";
import { generateKundali, vimshottariDasha, activeDashaChain, GRAHA_ORDER } from "vedic-kundali";
import { rashiLord } from "../src/modules/kundali/graha-reference.js";
import { makeExecutor } from "./helpers.js";

/**
 * Guards the GraphQL mapping and the friend/enemy synthesis, not the
 * underlying astronomy — `vedic-kundali`/`vedic-panchanga` have their own
 * accuracy tests. We check that the resolver reaches the library and returns
 * the same chart/dasha the library itself produces, and that the compound
 * friendship + gemstone matching is internally consistent.
 *
 * One deliberate exception: `vedic-kundali@0.1.0`'s `computeAscendant` returns
 * the Descendant (tropical longitude off by exactly 180°/6 rashis) — see the
 * workaround and its Swiss-Ephemeris-verified notes in `kundali.service.ts`.
 * The resolver corrects for it, so its ascendant/houses are the library's
 * shifted by 6 rashis/houses, not identical to `k.ascendant`/`k.houses`.
 */
const gql = makeExecutor();
const shiftSixRashis = (rashi: number) => ((rashi - 1 + 6) % 12) + 1;

const QUERY = `
  query ($date: String!, $time: String!, $lat: Float!, $lng: Float!) {
    kundaliRecommendation(date: $date, time: $time, latitude: $lat, longitude: $lng, timezone: "Asia/Kolkata") {
      ascendant { rashi rashiName { en } lord lordName { en } }
      moonSign { rashi rashiName { en } lord }
      nakshatra { name { en } pada }
      currentMahadasha { lord lordName { en } start end antardashaLord antardashaStart antardashaEnd }
      planetRelations {
        planet planetName { en } gemstone { en hi } lagnaFunctionalNature relationToLagnaLord relationToMahadashaLord
        dignity strength isCombust isRetrograde isYogakaraka isVargottama
      }
      favorablePlanets { planet }
      cautionPlanets { planet }
      neutralPlanets { planet }
      friendlyRashis { rashi rashiName { en } }
      enemyRashis { rashi rashiName { en } }
      recommendConsultation
      gemstoneRecommendation {
        planet planetName { en } gemstone { en hi } tier strength dignity isCombust isRetrograde isYogakaraka isVargottama
      }
      braceletCombo { house planet planetName { en } gemstone { en hi } beads }
      houses { house rashi rashiName { en } grahas }
      chandraHouses { house rashi rashiName { en } grahas }
      divisionalCharts {
        code
        label { en hi }
        houses { house rashi rashiName { en } grahas }
      }
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

    const correctedAscendantRashi = shiftSixRashis(k.ascendant.rashi);
    expect(r.ascendant.rashi).toBe(correctedAscendantRashi);
    expect(r.ascendant.rashiName.en).toBe(
      k.houses.find((h) => h.rashi === correctedAscendantRashi)?.rashiName.iast,
    );
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
      const correctedHouse = ((bhava.house - 1 + 6) % 12) + 1;
      const match = r.houses.find((h: { house: number }) => h.house === correctedHouse);
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

  it("applies the same 180°/6-rashi ascendant correction to every divisionalChart, not just D1", async () => {
    // 1949-12-12 07:03, Jaipur — cross-checked against buildDivisionalChart() called directly
    // with the corrected ascendant (see kundali.service.ts's `correctedAscendant`): the library's
    // own k.vargas are driven by its buggy ascendant and come out shifted by exactly 6 rashis,
    // same as k.ascendant itself, for every varga.
    const JAIPUR = { date: "1949-12-12", time: "07:03", lat: 26.9124, lng: 75.7873 };
    const res = await gql(QUERY, JAIPUR);
    const r = res.data.kundaliRecommendation;

    expect(r.divisionalCharts.map((c: { code: string }) => c.code)).toEqual(["D9", "D10", "D7", "D12"]);

    const lagnaRashiOf = (code: string) =>
      r.divisionalCharts
        .find((c: { code: string }) => c.code === code)
        .houses.find((h: { house: number }) => h.house === 1).rashi;
    expect(lagnaRashiOf("D9")).toBe(11);
    expect(lagnaRashiOf("D10")).toBe(12);
    expect(lagnaRashiOf("D7")).toBe(7);
    expect(lagnaRashiOf("D12")).toBe(5);

    for (const chart of r.divisionalCharts) {
      expect(chart.houses).toHaveLength(12);
      const allPlacedGrahas = chart.houses.flatMap((h: { grahas: string[] }) => h.grahas);
      expect(allPlacedGrahas.sort()).toEqual([...GRAHA_ORDER].sort());
    }
  });

  it("keeps favorablePlanets and cautionPlanets disjoint, driven by lagnaFunctionalNature", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;
    const favorable = new Set(r.favorablePlanets.map((p: { planet: string }) => p.planet));
    const caution = new Set(r.cautionPlanets.map((p: { planet: string }) => p.planet));
    for (const p of favorable) expect(caution.has(p)).toBe(false);

    for (const p of r.planetRelations) {
      expect(favorable.has(p.planet)).toBe(p.lagnaFunctionalNature === "FRIEND");
      expect(caution.has(p.planet)).toBe(p.lagnaFunctionalNature === "ENEMY");
    }
  });

  it("flags recommendConsultation exactly when the Mahādaśā lord is hostile to the Lagna lord", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;
    const caution = new Set(r.cautionPlanets.map((p: { planet: string }) => p.planet));
    expect(r.recommendConsultation).toBe(caution.has(r.currentMahadasha.lord));
  });

  it("partitions all nine grahas exactly across favorablePlanets, cautionPlanets and neutralPlanets", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;
    const favorable = r.favorablePlanets.map((p: { planet: string }) => p.planet);
    const caution = r.cautionPlanets.map((p: { planet: string }) => p.planet);
    const neutral = r.neutralPlanets.map((p: { planet: string }) => p.planet);
    const combined = [...favorable, ...caution, ...neutral];
    expect(combined.sort()).toEqual([...GRAHA_ORDER].sort());
    expect(new Set(combined).size).toBe(9);
  });

  it("derives friendlyRashis/enemyRashis from the friend/enemy planets' own sign-lordship", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;
    const favorable = new Set(r.favorablePlanets.map((p: { planet: string }) => p.planet));
    const caution = new Set(r.cautionPlanets.map((p: { planet: string }) => p.planet));

    for (const x of r.friendlyRashis) expect(favorable.has(rashiLord(x.rashi))).toBe(true);
    for (const x of r.enemyRashis) expect(caution.has(rashiLord(x.rashi))).toBe(true);

    const allRashiNumbers = [...r.friendlyRashis, ...r.enemyRashis].map((x: { rashi: number }) => x.rashi);
    expect(new Set(allRashiNumbers).size).toBe(allRashiNumbers.length);
  });

  it("classifies functional nature by house lordship for a Vrishchika (Scorpio) Lagna, not chart-placement Pañchadhā", async () => {
    // 1949-12-12 07:03, Jaipur — reported case: Lagna Vrishchika (Mars), Mahādaśā lord Saturn.
    const JAIPUR = { date: "1949-12-12", time: "07:03", lat: 26.9124, lng: 75.7873 };
    const res = await gql(QUERY, JAIPUR);
    const r = res.data.kundaliRecommendation;

    expect(r.ascendant.rashiName.en).toBe("Vrishchika");
    expect(r.ascendant.lord).toBe("Mars");
    expect(r.currentMahadasha.lord).toBe("Saturn");

    const favorable = new Set(r.favorablePlanets.map((p: { planet: string }) => p.planet));
    const caution = new Set(r.cautionPlanets.map((p: { planet: string }) => p.planet));

    // Trikona lords (Mars=1st/lagna, Jupiter=5th, Moon=9th) plus Sun (natural friend of Mars, no
    // house lordship of its own here) are friends; dusthana lords (Mercury=8th, Venus=12th) plus
    // Saturn (natural enemy of Mars, owns neither trikona nor dusthana) are enemies.
    expect(favorable.has("Mars")).toBe(true);
    expect(favorable.has("Moon")).toBe(true);
    expect(favorable.has("Jupiter")).toBe(true);
    expect(favorable.has("Sun")).toBe(true);
    expect(caution.has("Mercury")).toBe(true);
    expect(caution.has("Venus")).toBe(true);
    expect(caution.has("Saturn")).toBe(true);

    // The running Mahādaśā lord (Saturn) is itself functionally malefic here, so a consultation
    // is recommended instead of a gemstone match — the exact bug reported for this chart.
    expect(r.recommendConsultation).toBe(true);

    // recommendConsultation flags the Mahādaśā lord specifically — it doesn't block a separate,
    // narrower gemstoneRecommendation for a different graha (here the weak Lagna lord, Mars:
    // dignity ENEMY_SIGN since natal Mars sits in Kanya, ruled by Mercury, Mars's natural enemy).
    expect(r.gemstoneRecommendation).not.toBeNull();
    expect(r.gemstoneRecommendation.planet).toBe("Mars");
    expect(r.gemstoneRecommendation.tier).toBe("LAGNA_LORD");
    expect(r.gemstoneRecommendation.strength).not.toBe("STRONG");
  });

  it("computes dignity/strength consistently: EXALTED/OWN_SIGN → STRONG, DEBILITATED/ENEMY_SIGN → WEAK, unless combust", async () => {
    const res = await gql(QUERY, BIRTH);
    const r = res.data.kundaliRecommendation;
    for (const p of r.planetRelations) {
      if (p.dignity === "EXALTED" || p.dignity === "OWN_SIGN") {
        expect(p.strength).toBe(p.isCombust ? "MODERATE" : "STRONG");
      }
      if (p.dignity === "DEBILITATED" || p.dignity === "ENEMY_SIGN") {
        expect(p.strength).toBe("WEAK");
      }
      // Sun/Rāhu/Ketu can never be combust (Sun can't be combust with itself; Rāhu/Ketu are shadow points).
      if (p.planet === "Sun" || p.planet === "Rahu" || p.planet === "Ketu") {
        expect(p.isCombust).toBe(false);
      }
      // Sun/Moon are never retrograde; Rāhu/Ketu always are.
      if (p.planet === "Sun" || p.planet === "Moon") expect(p.isRetrograde).toBe(false);
      if (p.planet === "Rahu" || p.planet === "Ketu") expect(p.isRetrograde).toBe(true);
    }
  });

  it("only ever recommends a graha that is functionally FRIEND and not already STRONG", async () => {
    const cases = [
      BIRTH,
      { date: "1949-12-12", time: "07:03", lat: 26.9124, lng: 75.7873 },
      { date: "2000-11-23", time: "03:45", lat: 13.0827, lng: 80.2707 },
    ];
    for (const c of cases) {
      const res = await gql(QUERY, c);
      const g = res.data.kundaliRecommendation.gemstoneRecommendation;
      if (g === null) continue;
      expect(g.strength).not.toBe("STRONG");
      const favorable = new Set(
        res.data.kundaliRecommendation.favorablePlanets.map((p: { planet: string }) => p.planet),
      );
      expect(favorable.has(g.planet)).toBe(true);
    }
  });

  it("detects Saturn as Yogakaraka for a Tula (Libra) Lagna — the textbook case", async () => {
    // 2000-11-23 03:45, Chennai — Lagna Tula (Venus); Saturn rules 4th (Makara, kendra) and
    // 5th (Kumbha, trikona) from Tula, the classical Yogakaraka combination for Tula/Vrishabha.
    const CHENNAI = { date: "2000-11-23", time: "03:45", lat: 13.0827, lng: 80.2707 };
    const res = await gql(QUERY, CHENNAI);
    const r = res.data.kundaliRecommendation;
    expect(r.ascendant.rashiName.en).toBe("Tula");
    const saturn = r.planetRelations.find((p: { planet: string }) => p.planet === "Saturn");
    expect(saturn.isYogakaraka).toBe(true);
    const others = r.planetRelations.filter((p: { planet: string }) => p.planet !== "Saturn");
    for (const p of others) expect(p.isYogakaraka).toBe(false);
  });

  it("builds the combination bracelet from the 1st, 9th and 5th house lords — 9 / 7 / 5 of 21 beads", async () => {
    const res = await gql(QUERY, BIRTH);
    expect(res.errors).toBeUndefined();
    const r = res.data.kundaliRecommendation;
    const houseRashi = (n: number) => r.houses.find((h: { house: number }) => h.house === n).rashi;
    const combo = r.braceletCombo as { house: number; planet: string; gemstone: { en: string }; beads: number }[];

    expect(combo.map((b) => b.house)).toEqual([1, 9, 5]);
    expect(combo.map((b) => b.beads)).toEqual([9, 7, 5]);
    expect(combo.reduce((sum, b) => sum + b.beads, 0)).toBe(21);
    expect(combo[0]!.planet).toBe(r.ascendant.lord);
    for (const b of combo) expect(b.planet).toBe(rashiLord(houseRashi(b.house)));
    for (const b of combo) expect(b.gemstone.en).toBeTruthy();
  });

  it("gives all 12 lagnas three different lords for the 1st, 9th and 5th houses", () => {
    // The combination bracelet shows one gem block per lord, so a repeated lord would collapse two blocks into one.
    const houseRashi = (lagna: number, house: number) => ((lagna - 1 + house - 1) % 12) + 1;
    for (let lagna = 1; lagna <= 12; lagna++) {
      const lords = [1, 9, 5].map((h) => rashiLord(houseRashi(lagna, h)));
      expect(new Set(lords).size, `lagna ${lagna}: ${lords.join("/")}`).toBe(3);
    }
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
