import { computePanchanga, type Panchanga } from "@vastukosh/panchang";
import { env } from "../../config/env.js";
import { badInput } from "../../shared/errors.js";
import type { LocalizedString } from "../../shared/localized.js";

/**
 * Thin wrapper over `@vastukosh/panchang`. Resolves defaults from env, reshapes
 * the library result into GraphQL-friendly views (localised `{ en, hi }` names,
 * `Date` instants) and memoises per (date, location, month-system) for an hour —
 * the computation is deterministic, so a same-day repeat query is free.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TTL_MS = 60 * 60 * 1000;

export type PanchangAngaView = {
  index: number;
  name: LocalizedString;
  start: Date;
  end: Date;
  fractionElapsed: number;
  pada: number | null;
  lord: string | null;
};

export type PanchangKaalaView = {
  name: LocalizedString;
  start: Date;
  end: Date;
  quality: "auspicious" | "inauspicious";
};

export type PanchangView = {
  date: string;
  timezone: string;
  location: { latitude: number; longitude: number; place: string | null };
  ayanamsaSystem: string;
  ayanamsa: number;
  sunrise: Date;
  sunset: Date;
  nextSunrise: Date;
  solarNoon: Date | null;
  moonrise: Date | null;
  moonset: Date | null;
  vara: PanchangAngaView;
  tithi: PanchangAngaView;
  nakshatra: PanchangAngaView;
  yoga: PanchangAngaView;
  karana: PanchangAngaView;
  paksha: LocalizedString;
  masa: LocalizedString;
  masaAmanta: LocalizedString;
  masaPurnimanta: LocalizedString;
  ritu: LocalizedString;
  vikramSamvat: number;
  shakaSamvat: number;
  sunSign: LocalizedString;
  moonSign: LocalizedString;
  auspiciousPeriods: PanchangKaalaView[];
  inauspiciousPeriods: PanchangKaalaView[];
};

export type PanchangArgs = {
  date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  monthSystem?: "amanta" | "purnimanta" | null;
};

type NameLike = { iast: string; devanagari: string };
const localized = (n: NameLike): LocalizedString => ({ en: n.iast, hi: n.devanagari });

const memo = new Map<string, { at: number; value: PanchangView }>();

export function getPanchang(args: PanchangArgs): PanchangView {
  const latitude = args.latitude ?? env.PANCHANG_DEFAULT_LAT;
  const longitude = args.longitude ?? env.PANCHANG_DEFAULT_LNG;
  const timezone = args.timezone ?? env.PANCHANG_DEFAULT_TZ;
  const monthSystem = args.monthSystem ?? "amanta";

  // A human label only for the known default coordinates.
  const place =
    latitude === env.PANCHANG_DEFAULT_LAT &&
    longitude === env.PANCHANG_DEFAULT_LNG &&
    timezone === env.PANCHANG_DEFAULT_TZ
      ? env.PANCHANG_DEFAULT_PLACE
      : null;

  let date: Date;
  if (args.date) {
    if (!ISO_DATE.test(args.date)) throw badInput("date must be yyyy-mm-dd");
    // Noon UTC lands on the requested calendar day for every timezone from
    // UTC-12 to UTC+12; the library then resolves the civil day in `timezone`.
    date = new Date(`${args.date}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) throw badInput("date is not a valid calendar date");
  } else {
    date = new Date();
  }

  const dayKey = date.toISOString().slice(0, 10);
  const key = `${dayKey}|${latitude}|${longitude}|${timezone}|${monthSystem}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let result: Panchanga;
  try {
    result = computePanchanga({ date, latitude, longitude, timezone, monthSystem });
  } catch (err) {
    throw badInput(err instanceof Error ? err.message : "Could not compute panchang");
  }

  const view = toView(result, place);
  memo.set(key, { at: Date.now(), value: view });
  return view;
}

function toAngaView(a: Panchanga["tithi"] | Panchanga["nakshatra"]): PanchangAngaView {
  return {
    index: a.index,
    name: localized(a.name),
    start: a.start,
    end: a.end,
    fractionElapsed: a.fractionElapsed,
    pada: "pada" in a ? a.pada : null,
    lord: "lord" in a ? a.lord : null,
  };
}

function toKaalaView(k: Panchanga["auspiciousPeriods"][number]): PanchangKaalaView {
  return { name: localized(k.name), start: k.start, end: k.end, quality: k.quality };
}

function toView(p: Panchanga, place: string | null): PanchangView {
  return {
    date: p.date,
    timezone: p.timezone,
    location: { latitude: p.location.latitude, longitude: p.location.longitude, place },
    ayanamsaSystem: p.ayanamsaSystem,
    ayanamsa: p.ayanamsa,
    sunrise: p.sunrise,
    sunset: p.sunset,
    nextSunrise: p.nextSunrise,
    solarNoon: p.solarNoon,
    moonrise: p.moonrise,
    moonset: p.moonset,
    vara: toAngaView(p.vara),
    tithi: toAngaView(p.tithi),
    nakshatra: toAngaView(p.nakshatra),
    yoga: toAngaView(p.yoga),
    karana: toAngaView(p.karana),
    paksha: localized(p.paksha),
    masa: localized(p.masa),
    masaAmanta: localized(p.masaAmanta),
    masaPurnimanta: localized(p.masaPurnimanta),
    ritu: localized(p.ritu),
    vikramSamvat: p.vikramSamvat,
    shakaSamvat: p.shakaSamvat,
    sunSign: localized(p.sunSign),
    moonSign: localized(p.moonSign),
    auspiciousPeriods: p.auspiciousPeriods.map(toKaalaView),
    inauspiciousPeriods: p.inauspiciousPeriods.map(toKaalaView),
  };
}
