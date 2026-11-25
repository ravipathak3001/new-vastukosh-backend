import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { ALL_PERMISSION_KEYS } from "../src/modules/roles/permission-catalog.js";
import { DailyMantraModel } from "../src/modules/daily/daily.model.js";
import { makeExecutor, resetDb, startTestDb, stopTestDb } from "./helpers.js";

const token = (permissions: string[]) =>
  `Bearer ${signAccessToken({ sub: "000000000000000000000001", roles: ["admin"], permissions })}`;
const asAdmin = { authorization: token(ALL_PERMISSION_KEYS) };
const asViewer = { authorization: token(["daily.view"]) };

const gql = makeExecutor();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  vi.useRealTimers();
  await resetDb();
});

const L = (en: string) => ({ en, hi: en });

async function mantra(key: string, extra: Record<string, unknown> = {}) {
  await DailyMantraModel.create({ key, title: L(key), meaning: L("m"), published: true, ...extra });
}

describe("daily mantra", () => {
  it("prefers a date pin, then today's weekday, then the rotation", async () => {
    // 2026-11-24 12:00 IST is a Tuesday (weekday 2).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T06:30:00Z"));

    await mantra("rotation-a");
    await mantra("monday", { weekday: 1 });
    await mantra("tuesday", { weekday: 2 });
    let res = await gql(`{ dailyMantra { key weekday } }`);
    expect(res.data.dailyMantra).toEqual({ key: "tuesday", weekday: 2 });

    await mantra("pinned", { date: "2026-11-24" });
    res = await gql(`{ dailyMantra { key } }`);
    expect(res.data.dailyMantra.key).toBe("pinned");
  });

  it("lists published mantras weekday-first and hides drafts", async () => {
    await mantra("extra", { order: 0 });
    await mantra("saturday", { weekday: 6 });
    await mantra("sunday", { weekday: 0 });
    await mantra("draft", { weekday: 3, published: false });
    const res = await gql(`{ dailyMantras { key } }`);
    expect(res.data.dailyMantras.map((m: { key: string }) => m.key)).toEqual(["sunday", "saturday", "extra"]);
  });

  it("saves a weekday and audio from the admin, and rejects an invalid weekday", async () => {
    const save = `mutation($input: DailyMantraInput!) { upsertDailyMantra(input: $input) { key weekday audioUrl } }`;
    let res = await gql(
      save,
      { input: { key: "hanuman", title: L("Hanuman"), meaning: L("m"), weekday: 2, audioUrl: "https://media.test/a.mp3" } },
      asAdmin,
    );
    expect(res.data.upsertDailyMantra).toEqual({ key: "hanuman", weekday: 2, audioUrl: "https://media.test/a.mp3" });

    res = await gql(save, { input: { key: "hanuman", weekday: 9 } }, asAdmin);
    expect(res.errors?.length).toBeGreaterThan(0);
  });
});

describe("Vastu tips", () => {
  const save = `mutation($input: DailyVastuTipInput!) { upsertDailyVastuTip(input: $input) { key icon title { en } } }`;
  const tip = (key: string, published = true) => ({
    key,
    area: L("Kitchen"),
    title: L(`Tip ${key}`),
    body: L("Body"),
    icon: "local_fire_department",
    published,
  });

  it("creates, lists, edits and deletes tips; the public only sees published ones", async () => {
    expect((await gql(save, { input: tip("kitchen") }, asAdmin)).data.upsertDailyVastuTip).toEqual({
      key: "kitchen",
      icon: "local_fire_department",
      title: { en: "Tip kitchen" },
    });
    await gql(save, { input: tip("draft", false) }, asAdmin);

    const pub = await gql(`{ vastuTips { key } dailyVastuTip { key } }`);
    expect(pub.data.vastuTips).toEqual([{ key: "kitchen" }]);
    expect(pub.data.dailyVastuTip).toEqual({ key: "kitchen" });

    const admin = await gql(`{ adminDailyVastuTips { key published } }`, {}, asAdmin);
    expect(admin.data.adminDailyVastuTips).toHaveLength(2);

    await gql(save, { input: { key: "kitchen", title: L("Cook facing east") } }, asAdmin);
    expect((await gql(`{ vastuTips { title { en } } }`)).data.vastuTips[0].title.en).toBe("Cook facing east");

    const del = await gql(`mutation { deleteDailyVastuTip(key: "kitchen") }`, {}, asAdmin);
    expect(del.data.deleteDailyVastuTip).toBe(true);
    expect((await gql(`{ vastuTips { key } }`)).data.vastuTips).toEqual([]);
  });

  it("needs daily.manage to change tips", async () => {
    const res = await gql(save, { input: tip("x") }, asViewer);
    expect(res.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    expect((await gql(save, { input: tip("x") })).errors?.length).toBeGreaterThan(0);
  });
});
