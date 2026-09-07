import { computePanchanga, type Anga, type Panchanga } from "vedic-panchanga";
import { env } from "../../config/env.js";
import { badInput } from "../../shared/errors.js";
import type { LocalizedString } from "../../shared/localized.js";

/**
 * Thin wrapper over `vedic-panchanga`. Resolves defaults from env, reshapes
 * the library result into GraphQL-friendly views (localised `{ en, hi }` names,
 * `Date` instants) and memoises per (date, location, month-system) for an hour —
 * the computation is deterministic, so a same-day repeat query is free.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
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

export type PanchangReferenceView = {
  /** "sunrise" (the almanac default) or "time" when a `time` arg was given. */
  kind: "sunrise" | "time";
  /** The instant every anga, sign and `fractionElapsed` below was evaluated at. */
  instant: Date;
};

export type PanchangView = {
  date: string;
  timezone: string;
  location: { latitude: number; longitude: number; place: string | null };
  ayanamsaSystem: string;
  ayanamsa: number;
  reference: PanchangReferenceView;
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
  /** Auspicious/inauspicious windows that contain `reference.instant` — the
   *  "what am I in right now" answer. Empty in sunrise mode. */
  currentPeriods: PanchangKaalaView[];
};

export type PanchangArgs = {
  date?: string | null;
  time?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  monthSystem?: "amanta" | "purnimanta" | null;
};

type NameLike = { iast: string; devanagari: string };
const localized = (n: NameLike): LocalizedString => ({ en: n.iast, hi: n.devanagari });

const memo = new Map<string, { at: number; value: PanchangView }>();

function isoDateOf(date: Date): string {
  // Deliberately not timezone-aware — `date` is always the noon-UTC anchor
  // built below, which lands on the same calendar day for tz offsets ±12h.
  return date.toISOString().slice(0, 10);
}

function resolveLocation(args: PanchangArgs) {
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

  return { latitude, longitude, timezone, monthSystem, place, date };
}

export function getPanchang(args: PanchangArgs): PanchangView {
  const { latitude, longitude, timezone, monthSystem, place, date } = resolveLocation(args);

  let time: string | undefined;
  if (args.time != null && args.time !== "") {
    if (!WALL_TIME.test(args.time)) throw badInput("time must be HH:MM or HH:MM:SS (24-hour)");
    time = args.time;
  }

  const dayKey = isoDateOf(date);
  const key = `${dayKey}|${time ?? ""}|${latitude}|${longitude}|${timezone}|${monthSystem}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let result: Panchanga;
  try {
    result = computePanchanga({ date, time, latitude, longitude, timezone, monthSystem });
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
    reference: { kind: p.reference.kind, instant: p.reference.instant },
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
    currentPeriods: p.currentPeriods.map(toKaalaView),
  };
}

// ─── Full-day timeline ──────────────────────────────────────────────────────
// The chart view (sunrise → next sunrise) needs every segment each anga
// occupies across the day, not just the one active at sunrise. `computePanchanga`
// only ever answers "what's active at this instant", so we walk forward from
// the sunrise-anga's `end`, re-querying just past each boundary, until we've
// covered the full span. Pure/sync/no I/O, so a handful of extra calls is cheap.

export type PanchangSegmentView = {
  index: number;
  name: LocalizedString;
  start: Date;
  end: Date;
};

export type PanchangTimelineView = {
  date: string;
  timezone: string;
  location: { latitude: number; longitude: number; place: string | null };
  sunrise: Date;
  sunset: Date;
  nextSunrise: Date;
  moonrise: Date | null;
  moonset: Date | null;
  vara: LocalizedString;
  tithiSegments: PanchangSegmentView[];
  nakshatraSegments: PanchangSegmentView[];
  yogaSegments: PanchangSegmentView[];
  karanaSegments: PanchangSegmentView[];
  auspiciousPeriods: PanchangKaalaView[];
  inauspiciousPeriods: PanchangKaalaView[];
};

const timelineMemo = new Map<string, { at: number; value: PanchangTimelineView }>();

/** Max segments per anga in one day — tithi/nakshatra/yoga rarely exceed 2, karana rarely exceeds 4. */
const MAX_SEGMENTS = 6;

function toSegmentView(a: Anga): PanchangSegmentView {
  return { index: a.index, name: localized(a.name), start: a.start, end: a.end };
}

/** yyyy-mm-dd and HH:mm:ss for `instant`, read in `timezone` — what `computePanchanga`'s `date`+`time` options expect. */
function wallClockParts(instant: Date, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function buildSegments(
  first: Anga,
  pick: (p: Panchanga) => Anga,
  location: { latitude: number; longitude: number; timezone: string; monthSystem: "amanta" | "purnimanta" },
  nextSunrise: Date,
): PanchangSegmentView[] {
  const segments: PanchangSegmentView[] = [toSegmentView(first)];

  for (let i = 0; i < MAX_SEGMENTS; i++) {
    const last = segments[segments.length - 1]!;
    if (last.end.getTime() >= nextSunrise.getTime()) break;

    // A minute past the boundary avoids landing exactly on it (ambiguous which
    // side); every anga here runs for hours, so this never skips a segment.
    const cursor = new Date(last.end.getTime() + 60_000);
    const { date: cursorDate, time: cursorTime } = wallClockParts(cursor, location.timezone);
    const next = computePanchanga({
      date: new Date(`${cursorDate}T12:00:00Z`),
      time: cursorTime,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      monthSystem: location.monthSystem,
    });
    segments.push(toSegmentView(pick(next)));
  }

  return segments;
}

export function getPanchangTimeline(args: PanchangArgs): PanchangTimelineView {
  const { latitude, longitude, timezone, monthSystem, place, date } = resolveLocation(args);

  const dayKey = isoDateOf(date);
  const key = `timeline|${dayKey}|${latitude}|${longitude}|${timezone}|${monthSystem}`;
  const hit = timelineMemo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let base: Panchanga;
  try {
    base = computePanchanga({ date, latitude, longitude, timezone, monthSystem });
  } catch (err) {
    throw badInput(err instanceof Error ? err.message : "Could not compute panchang");
  }

  const loc = { latitude, longitude, timezone, monthSystem };
  const view: PanchangTimelineView = {
    date: base.date,
    timezone: base.timezone,
    location: { latitude: base.location.latitude, longitude: base.location.longitude, place },
    sunrise: base.sunrise,
    sunset: base.sunset,
    nextSunrise: base.nextSunrise,
    moonrise: base.moonrise,
    moonset: base.moonset,
    vara: localized(base.vara.name),
    tithiSegments: buildSegments(base.tithi, (p) => p.tithi, loc, base.nextSunrise),
    nakshatraSegments: buildSegments(base.nakshatra, (p) => p.nakshatra, loc, base.nextSunrise),
    yogaSegments: buildSegments(base.yoga, (p) => p.yoga, loc, base.nextSunrise),
    karanaSegments: buildSegments(base.karana, (p) => p.karana, loc, base.nextSunrise),
    auspiciousPeriods: base.auspiciousPeriods.map(toKaalaView),
    inauspiciousPeriods: base.inauspiciousPeriods.map(toKaalaView),
  };
  timelineMemo.set(key, { at: Date.now(), value: view });
  return view;
}
