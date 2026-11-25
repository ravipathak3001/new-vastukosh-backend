import data from "./data/places.json" with { type: "json" };

/**
 * Offline place search for the panchang page — no third-party geocoder.
 *
 * Data: GeoNames (geonames.org, CC BY 4.0): every Indian town of 5,000+
 * people plus cities of 100,000+ worldwide, each with its IANA timezone.
 * Rebuild with `scripts/build-places.py` (see the header there).
 */

export type PlaceView = {
  name: string;
  /** Hindi display name when GeoNames has one unambiguous Devanagari spelling. */
  nameHi: string | null;
  region: string | null;
  country: string;
  countryName: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type Row = [string, string, string, string, number, number, number, number, string, string];

const timezones = data.timezones as string[];
const countries = data.countries as Record<string, string>;
const rows = data.places as unknown as Row[];

/** Lower-case, accents stripped, punctuation folded to spaces. */
function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

type Indexed = { row: Row; keys: string[] };

let index: Indexed[] | null = null;
function getIndex(): Indexed[] {
  if (index) return index;
  index = rows.map((row) => {
    const keys = [norm(row[0])];
    if (row[8]) keys.push(norm(row[8]));
    for (const hi of row[9] ? row[9].split("|") : []) keys.push(norm(hi));
    return { row, keys };
  });
  return index;
}

function toView(row: Row): PlaceView {
  return {
    name: row[0],
    nameHi: row[1] || null,
    region: row[2] || null,
    country: row[3],
    countryName: countries[row[3]] ?? row[3],
    latitude: row[4],
    longitude: row[5],
    timezone: timezones[row[6]] ?? "UTC",
  };
}

/**
 * Places matching `query` — whole-name matches first, then name prefixes, then
 * any word in the name ("delhi" finds New Delhi). Ties go to Indian places,
 * then larger populations. Works with English or Devanagari input.
 */
export function searchPlaces(query: string, limit = 8): PlaceView[] {
  const q = norm(query).slice(0, 60);
  if (q.length < 2) return [];
  const max = Math.min(Math.max(limit, 1), 20);

  const scored: { score: number; row: Row }[] = [];
  for (const { row, keys } of getIndex()) {
    let best = 0;
    for (const k of keys) {
      if (k === q) best = Math.max(best, 3);
      else if (k.startsWith(q)) best = Math.max(best, 2);
      else if (k.includes(` ${q}`)) best = Math.max(best, 1);
    }
    if (best) scored.push({ score: best * 10 + (row[3] === "IN" ? 1 : 0), row });
  }
  scored.sort((a, b) => b.score - a.score || b.row[7] - a.row[7]);
  return scored.slice(0, max).map((s) => toView(s.row));
}

/** The listed place nearest to a point (for "use my location"). */
export function nearestPlace(latitude: number, longitude: number): PlaceView | null {
  const rad = Math.PI / 180;
  const cosLat = Math.cos(latitude * rad);
  let best: Row | null = null;
  let bestD = Infinity;
  for (const row of rows) {
    // Equirectangular distance is plenty to rank nearby points.
    const dx = (row[5] - longitude) * cosLat;
    const dy = row[4] - latitude;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = row;
    }
  }
  // Further than ~150 km from any listed place: don't claim a name.
  return best && Math.sqrt(bestD) < 1.4 ? toView(best) : null;
}
