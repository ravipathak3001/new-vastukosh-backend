/**
 * One-off: swap contact details written into legal docs and FAQs for
 * `{{phone}}` / `{{email}}` / `{{address}}` placeholders, so they follow
 * Admin → Site settings from now on (see `modules/content/site-tokens.ts`).
 *
 *   npm run content:tokens            # preview only — changes nothing
 *   npm run content:tokens -- --apply # write the changes
 *   npm run content:tokens -- --apply --only=terms   # just one legal doc
 *
 * Replaces the original placeholder details (+91 98765 43210,
 * support@vastukosh.com, 108 Harmony Way…) and also whatever is currently
 * saved in Site settings, in case someone already typed the real ones in.
 */
import { connectDb, disconnectDb } from "../db/connection.js";
import { FaqModel, LegalDocModel } from "../modules/content/content.model.js";
import { SiteSettingsModel } from "../modules/seo/site-settings.model.js";

const apply = process.argv.includes("--apply");
/** `--only=terms` limits the run to one legal doc (by slug) — handy for a first, single-page check. */
const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Match a phone number however it's spaced: "+91 98765 43210", "+919876543210", "98765-43210". */
const phonePattern = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length < 10) return null;
  return new RegExp(`(?:\\+?91[\\s-]?)?${local.split("").join("[\\s-]?")}`, "g");
};

async function main() {
  await connectDb();
  const s = await SiteSettingsModel.findOne({ key: "default" }).lean();

  const rules: { token: string; re: RegExp }[] = [];
  const addEmail = (e?: string | null) => e?.trim() && rules.push({ token: "{{email}}", re: new RegExp(escape(e.trim()), "gi") });
  const addPhone = (p?: string | null) => {
    const re = p ? phonePattern(p) : null;
    if (re) rules.push({ token: "{{phone}}", re });
  };
  const addAddress = (a?: string | null) => a?.trim() && a.trim().length > 15 && rules.push({ token: "{{address}}", re: new RegExp(escape(a.trim()), "g") });

  addEmail("support@vastukosh.com");
  addPhone("+91 98765 43210");
  addAddress("108 Harmony Way, Spiritual District, New Delhi, 110001, India");
  addEmail(s?.email);
  addPhone(s?.phone);
  addAddress(s?.addressText);

  const swap = (text: string | null | undefined, counts: Map<string, number>) => {
    if (!text) return text;
    let out = text;
    for (const { token, re } of rules) {
      out = out.replace(re, () => {
        counts.set(token, (counts.get(token) ?? 0) + 1);
        return token;
      });
    }
    return out;
  };
  type Loc = { en?: string | null; hi?: string | null };
  const swapL = (v: Loc | undefined | null, c: Map<string, number>) => {
    if (!v) return v;
    v.en = swap(v.en, c) ?? v.en;
    v.hi = swap(v.hi, c) ?? v.hi;
    return v;
  };

  let changedDocs = 0;
  const report = (what: string, counts: Map<string, number>) => {
    if (!counts.size) return false;
    changedDocs++;
    console.log(`  ${what}: ${[...counts].map(([t, n]) => `${n}× ${t}`).join(", ")}`);
    return true;
  };

  console.log(apply ? "Applying changes…" : "Preview (nothing is written — add --apply to save):");
  for (const doc of await LegalDocModel.find(only ? { slug: only } : {})) {
    const c = new Map<string, number>();
    swapL(doc.title, c);
    for (const sec of doc.sections) {
      swapL(sec.heading, c);
      swapL(sec.body, c);
    }
    if (report(`Legal doc "${doc.slug}"`, c) && apply) {
      doc.markModified("sections");
      doc.markModified("title");
      await doc.save();
    }
  }
  for (const doc of only ? [] : await FaqModel.find()) {
    const c = new Map<string, number>();
    swapL(doc.question, c);
    swapL(doc.answer, c);
    if (report(`FAQ "${doc.key}"`, c) && apply) {
      doc.markModified("question");
      doc.markModified("answer");
      await doc.save();
    }
  }
  console.log(changedDocs ? `${changedDocs} document(s) ${apply ? "updated" : "would change"}.` : "Nothing to change.");
  await disconnectDb();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
