import { notFound } from "../../shared/errors.js";
import {
  DailyCardModel,
  DailyMantraModel,
  DailyVerseModel,
  type DailyCardDoc,
  type DailyMantraDoc,
  type DailyVerseDoc,
} from "./daily.model.js";

/** yyyy-mm-dd for "today" in the given IANA tz (default IST). */
function todayISO(tz = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayOfYear(d = new Date()): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86_400_000);
}

function rotate<T>(pool: T[]): T | null {
  if (pool.length === 0) return null;
  return pool[dayOfYear() % pool.length] ?? null;
}

// ─── Public reads ────────────────────────────────────────────────────────
export async function dailyMantra(): Promise<DailyMantraDoc | null> {
  const iso = todayISO();
  return (
    (await DailyMantraModel.findOne({ published: true, date: iso }).exec()) ??
    rotate(
      await DailyMantraModel.find({ published: true })
        .sort({ order: 1, createdAt: 1 })
        .exec(),
    )
  );
}

export async function dailyVerse(): Promise<DailyVerseDoc | null> {
  const iso = todayISO();
  return (
    (await DailyVerseModel.findOne({ published: true, date: iso }).exec()) ??
    rotate(
      await DailyVerseModel.find({ published: true })
        .sort({ order: 1, createdAt: 1 })
        .exec(),
    )
  );
}

export function dailyCards(limit = 12): Promise<DailyCardDoc[]> {
  return DailyCardModel.find({ published: true })
    .sort({ date: -1, order: 1, createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 50))
    .exec();
}

// ─── Admin: mantras ──────────────────────────────────────────────────────
export function listMantrasForAdmin(): Promise<DailyMantraDoc[]> {
  return DailyMantraModel.find().sort({ order: 1, createdAt: -1 }).exec();
}
export function upsertMantra(
  input: { key: string } & Record<string, unknown>,
): Promise<DailyMantraDoc> {
  return DailyMantraModel.findOneAndUpdate(
    { key: input.key },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec() as Promise<DailyMantraDoc>;
}
export async function deleteMantra(key: string): Promise<boolean> {
  const doc = await DailyMantraModel.findOneAndDelete({ key }).exec();
  if (!doc) throw notFound("Daily mantra");
  return true;
}

// ─── Admin: verses ───────────────────────────────────────────────────────
export function listVersesForAdmin(): Promise<DailyVerseDoc[]> {
  return DailyVerseModel.find().sort({ order: 1, createdAt: -1 }).exec();
}
export function upsertVerse(
  input: { key: string } & Record<string, unknown>,
): Promise<DailyVerseDoc> {
  return DailyVerseModel.findOneAndUpdate(
    { key: input.key },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec() as Promise<DailyVerseDoc>;
}
export async function deleteVerse(key: string): Promise<boolean> {
  const doc = await DailyVerseModel.findOneAndDelete({ key }).exec();
  if (!doc) throw notFound("Daily verse");
  return true;
}

// ─── Admin: cards ────────────────────────────────────────────────────────
export function listCardsForAdmin(): Promise<DailyCardDoc[]> {
  return DailyCardModel.find().sort({ order: 1, createdAt: -1 }).exec();
}
export function upsertCard(
  input: { key: string } & Record<string, unknown>,
): Promise<DailyCardDoc> {
  return DailyCardModel.findOneAndUpdate(
    { key: input.key },
    { $set: input },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).exec() as Promise<DailyCardDoc>;
}
export async function deleteCard(key: string): Promise<boolean> {
  const doc = await DailyCardModel.findOneAndDelete({ key }).exec();
  if (!doc) throw notFound("Daily card");
  return true;
}
