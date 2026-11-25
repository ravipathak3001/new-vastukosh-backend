/**
 * `npm run seed:daily` — adds the starter weekday mantras and Vastu tips.
 *
 * Insert-only and safe on a live database: a record whose `key` already
 * exists is left exactly as it is (so edits made in the admin panel survive),
 * and nothing else in the database is touched. Unlike `npm run seed`, which
 * overwrites every seeded collection.
 */
import { connectDb, disconnectDb } from "./connection.js";
import { logger } from "../config/logger.js";
import { DailyMantraModel, DailyVastuTipModel } from "../modules/daily/daily.model.js";
import { vastuTipSeeds, weekdayMantraSeeds } from "./seeds/daily.js";

async function insertMissing(
  model: { updateOne: (f: object, u: object, o: object) => Promise<{ upsertedCount?: number }> },
  items: { key: string }[],
): Promise<number> {
  let added = 0;
  for (const item of items) {
    const res = await model.updateOne({ key: item.key }, { $setOnInsert: item }, { upsert: true });
    added += res.upsertedCount ?? 0;
  }
  return added;
}

async function main() {
  await connectDb();
  const mantras = await insertMissing(DailyMantraModel, weekdayMantraSeeds);
  const tips = await insertMissing(DailyVastuTipModel, vastuTipSeeds);
  logger.info(
    { mantrasAdded: mantras, tipsAdded: tips, skipped: weekdayMantraSeeds.length + vastuTipSeeds.length - mantras - tips },
    "Daily content seed complete (existing records untouched)",
  );
  await disconnectDb();
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, "Daily content seed failed");
  process.exit(1);
});
